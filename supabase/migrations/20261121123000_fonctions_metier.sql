-- =============================================================================
-- Fonctions métier : la base décide, le navigateur appelle.
-- Chaque fonction : vérifie le rôle, verrouille les lignes concernées,
-- fait tout ou rien, et note son nom dans le journal d'audit (« comment »).
-- =============================================================================

-- Heure limite de réservation et d'annulation : le jour même à 8h (heure d'Abidjan).
create function public.heure_limite(p_jour date)
returns timestamptz
language sql stable
set search_path = public
as $$ select (p_jour + time '08:00') at time zone 'Africa/Abidjan' $$;

-- Erreur métier lisible par l'interface (code P0001 + message en français).
create function prive.refuser(p_message text)
returns void
language plpgsql
set search_path = public
as $$ begin raise exception using errcode = 'P0001', message = p_message; end $$;

-- Rôle de l'utilisateur connecté (null si non connecté).
create function prive.mon_role()
returns public.role_utilisateur
language sql stable
security definer
set search_path = public
as $$ select role from public.profils where id = auth.uid() $$;

-- Code court unique pour le jour : VTL-0000 à VTL-9999.
create function prive.nouveau_code_court(p_jour date)
returns text
language plpgsql
set search_path = public
as $$
declare
  v text;
begin
  loop
    v := 'VTL-' || lpad(floor(random() * 10000)::int::text, 4, '0');
    exit when not exists (select 1 from public.reservations where jour = p_jour and code_court = v);
  end loop;
  return v;
end;
$$;

-- -----------------------------------------------------------------------------
-- Lecture : menu avec disponibilités (seulement des chiffres agrégés, aucune donnée personnelle)
-- -----------------------------------------------------------------------------
create function public.menu_periode(p_debut date, p_fin date)
returns table (
  menu_jour_id bigint, jour date, plat_id bigint, nom text, description text, prix integer,
  type public.type_plat, allergenes text[], vegetarien boolean, photo_url text,
  portions_prevues integer, reservees integer, restantes integer,
  note_moyenne numeric, nb_notes integer,
  prix_offre integer, fin_offre timestamptz, offre_active boolean, reservable boolean
)
language sql stable
security definer
set search_path = public
as $$
  select m.id, m.jour, p.id, p.nom, p.description, p.prix, p.type, p.allergenes, p.vegetarien, p.photo_url,
         m.portions_prevues,
         coalesce(r.nb, 0)::int,
         greatest(coalesce(m.portions_preparees, m.portions_prevues) - coalesce(r.nb, 0), 0)::int,
         n.moyenne, coalesce(n.nb, 0)::int,
         m.prix_offre, m.fin_offre,
         (m.prix_offre is not null and now() < m.fin_offre and m.jour = public.aujourdhui()),
         (now() < public.heure_limite(m.jour))
  from public.menus_jour m
  join public.plats p on p.id = m.plat_id
  left join lateral (select count(*) nb from public.reservations x
                     where x.menu_jour_id = m.id and x.statut <> 'annulee') r on true
  left join lateral (select round(avg(no.valeur), 1) moyenne, count(*) nb
                     from public.notes no join public.reservations rr on rr.id = no.reservation_id
                     join public.menus_jour mm on mm.id = rr.menu_jour_id
                     where mm.plat_id = p.id) n on true
  where m.jour between p_debut and p_fin and p.actif
    and auth.uid() is not null
  order by m.jour, p.type, p.nom
$$;

create function public.creneaux_jour(p_jour date)
returns table (creneau_id smallint, heure_debut time, capacite integer, reservees integer, restantes integer)
language sql stable
security definer
set search_path = public
as $$
  select c.id, c.heure_debut, c.capacite, coalesce(r.nb, 0)::int, greatest(c.capacite - coalesce(r.nb, 0), 0)::int
  from public.creneaux c
  left join lateral (select count(*) nb from public.reservations x
                     where x.creneau_id = c.id and x.jour = p_jour and x.statut <> 'annulee') r on true
  where c.actif and auth.uid() is not null
  order by c.heure_debut
$$;

-- -----------------------------------------------------------------------------
-- Réserver
-- -----------------------------------------------------------------------------
create function public.reserver(p_menu_jour bigint, p_creneau smallint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profil public.profils;
  v_menu public.menus_jour;
  v_prix_plat integer;
  v_offre boolean;
  v_prix integer;
  v_cap integer;
  v_pris integer;
  v_res public.reservations;
begin
  perform set_config('app.operation', 'reserver', true);
  if v_uid is null then perform prive.refuser('Veuillez vous connecter.'); end if;

  -- Verrous : le profil (solde) puis le menu (portions) puis le créneau (places).
  select * into v_profil from public.profils where id = v_uid for update;
  if v_profil.role is distinct from 'convive' then
    perform prive.refuser('Seuls les convives peuvent réserver un repas.');
  end if;

  select * into v_menu from public.menus_jour where id = p_menu_jour for update;
  if not found then perform prive.refuser('Ce plat n''est pas au menu.'); end if;
  select prix into v_prix_plat from public.plats where id = v_menu.plat_id and actif;
  if not found then perform prive.refuser('Ce plat n''est plus proposé.'); end if;

  v_offre := v_menu.prix_offre is not null and now() < v_menu.fin_offre and v_menu.jour = public.aujourdhui();
  if v_menu.jour < public.aujourdhui() then
    perform prive.refuser('Ce jour est passé.');
  end if;
  if not v_offre and now() >= public.heure_limite(v_menu.jour) then
    perform prive.refuser('Les réservations pour ce jour sont closes (limite : 8h le jour même).');
  end if;
  v_prix := case when v_offre then v_menu.prix_offre else v_prix_plat end;

  select count(*) into v_pris from public.reservations
   where menu_jour_id = v_menu.id and statut <> 'annulee';
  if v_pris >= coalesce(v_menu.portions_preparees, v_menu.portions_prevues) then
    perform prive.refuser('Plus de portion disponible pour ce plat.');
  end if;

  select capacite into v_cap from public.creneaux where id = p_creneau and actif for update;
  if not found then perform prive.refuser('Créneau inconnu.'); end if;
  select count(*) into v_pris from public.reservations
   where creneau_id = p_creneau and jour = v_menu.jour and statut <> 'annulee';
  if v_pris >= v_cap then perform prive.refuser('Ce créneau est complet, choisissez-en un autre.'); end if;

  if exists (select 1 from public.reservations
             where utilisateur_id = v_uid and jour = v_menu.jour and statut <> 'annulee') then
    perform prive.refuser('Vous avez déjà un repas réservé ce jour-là.');
  end if;

  if v_profil.solde < v_prix then
    perform prive.refuser(format('Solde insuffisant : %s F disponibles, %s F nécessaires.', v_profil.solde, v_prix));
  end if;

  insert into public.reservations
    (utilisateur_id, menu_jour_id, creneau_id, jour, prix_paye, est_offre, jeton_qr, code_court)
  values
    (v_uid, v_menu.id, p_creneau, v_menu.jour, v_prix, v_offre,
     replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
     prive.nouveau_code_court(v_menu.jour))
  returning * into v_res;

  update public.profils set solde = solde - v_prix where id = v_uid;
  insert into public.transactions (utilisateur_id, type, montant, reservation_id, solde_apres)
  values (v_uid, 'debit', v_prix, v_res.id, v_profil.solde - v_prix);

  return json_build_object('reservation_id', v_res.id, 'code_court', v_res.code_court,
                           'jeton_qr', v_res.jeton_qr, 'prix_paye', v_prix, 'solde', v_profil.solde - v_prix);
end;
$$;

-- -----------------------------------------------------------------------------
-- Annuler (avant 8h le jour même) : remboursement intégral
-- -----------------------------------------------------------------------------
create function public.annuler(p_reservation bigint)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_res public.reservations;
  v_solde integer;
begin
  perform set_config('app.operation', 'annuler', true);
  select * into v_res from public.reservations where id = p_reservation for update;
  if not found or v_res.utilisateur_id is distinct from v_uid then
    perform prive.refuser('Réservation introuvable.');
  end if;
  if v_res.statut <> 'reservee' then perform prive.refuser('Cette réservation ne peut plus être annulée.'); end if;
  if v_res.est_offre then perform prive.refuser('Une offre de fin de service ne peut pas être annulée.'); end if;
  if now() >= public.heure_limite(v_res.jour) then
    perform prive.refuser('Trop tard pour annuler (limite : 8h le jour même).');
  end if;

  update public.reservations set statut = 'annulee', annule_le = now() where id = v_res.id;
  update public.profils set solde = solde + v_res.prix_paye where id = v_uid returning solde into v_solde;
  insert into public.transactions (utilisateur_id, type, montant, reservation_id, solde_apres)
  values (v_uid, 'remboursement', v_res.prix_paye, v_res.id, v_solde);

  return json_build_object('reservation_id', v_res.id, 'rembourse', v_res.prix_paye, 'solde', v_solde);
end;
$$;

-- -----------------------------------------------------------------------------
-- Recharger (Mobile Money simulé)
-- -----------------------------------------------------------------------------
create function public.recharger(p_montant integer, p_moyen public.moyen_paiement)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_solde integer;
begin
  perform set_config('app.operation', 'recharger', true);
  if prive.mon_role() is distinct from 'convive' then
    perform prive.refuser('Seuls les convives peuvent recharger leur compte.');
  end if;
  if p_montant not in (1000, 2000, 5000, 10000) then
    perform prive.refuser('Montant de recharge non autorisé.');
  end if;
  update public.profils set solde = solde + p_montant where id = v_uid returning solde into v_solde;
  insert into public.transactions (utilisateur_id, type, montant, moyen, solde_apres)
  values (v_uid, 'recharge', p_montant, p_moyen, v_solde);
  return json_build_object('solde', v_solde);
end;
$$;

-- -----------------------------------------------------------------------------
-- Servir (admin, au comptoir) : on scanne AVANT de servir.
-- Renvoie de quoi afficher l'écran vert ou rouge. Les refus sont journalisés.
-- -----------------------------------------------------------------------------
create function public.servir(p_code text)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(p_code));
  v_res public.reservations;
  v_raison text;
  v_info json;
begin
  perform set_config('app.operation', 'servir', true);
  if prive.mon_role() is distinct from 'admin' then
    perform prive.refuser('Seul un administrateur peut valider un retrait.');
  end if;

  select * into v_res from public.reservations
   where jeton_qr = lower(trim(p_code)) or (code_court = v_code and jour = public.aujourdhui())
   order by (jeton_qr = lower(trim(p_code))) desc
   limit 1
   for update;

  v_raison := case
    when not found then 'inconnu'
    when v_res.jour <> public.aujourdhui() then 'autre_jour'
    when v_res.statut = 'annulee' then 'annule'
    when v_res.statut = 'servie' then 'deja_servi'
  end;

  if v_res.id is not null then
    select json_build_object(
             'reservation_id', v_res.id, 'code_court', v_res.code_court, 'jour', v_res.jour,
             'plat', pl.nom, 'convive', pr.nom, 'categorie', pr.categorie,
             'allergies', pr.allergies, 'vegetarien', pr.vegetarien,
             'creneau', to_char(c.heure_debut, 'HH24:MI'), 'scanne_le', v_res.scanne_le)
      into v_info
      from public.menus_jour m join public.plats pl on pl.id = m.plat_id
      join public.profils pr on pr.id = v_res.utilisateur_id
      join public.creneaux c on c.id = v_res.creneau_id
     where m.id = v_res.menu_jour_id;
  end if;

  if v_raison is not null then
    perform public.journaliser('REFUS', 'reservations', v_res.id::text, null, null,
                               json_build_object('raison', v_raison, 'code_saisi', v_code)::jsonb);
    return json_build_object('ok', false, 'raison', v_raison, 'ticket', v_info);
  end if;

  update public.reservations
     set statut = 'servie', scanne_le = now(), remis_le = now(), servi_par = auth.uid()
   where id = v_res.id;
  return json_build_object('ok', true, 'ticket', v_info);
end;
$$;

-- -----------------------------------------------------------------------------
-- Noter un repas servi (1 à 5)
-- -----------------------------------------------------------------------------
create function public.noter(p_reservation bigint, p_valeur smallint, p_commentaire text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.reservations;
begin
  perform set_config('app.operation', 'noter', true);
  select * into v_res from public.reservations where id = p_reservation;
  if not found or v_res.utilisateur_id is distinct from auth.uid() then
    perform prive.refuser('Réservation introuvable.');
  end if;
  if v_res.statut <> 'servie' then perform prive.refuser('Vous ne pouvez noter qu''un repas servi.'); end if;
  if exists (select 1 from public.notes where reservation_id = p_reservation) then
    perform prive.refuser('Ce repas a déjà été noté.');
  end if;
  insert into public.notes (reservation_id, valeur, commentaire)
  values (p_reservation, p_valeur, nullif(trim(p_commentaire), ''));
end;
$$;

-- -----------------------------------------------------------------------------
-- Lancer une offre de fin de service (admin)
-- -----------------------------------------------------------------------------
create function public.lancer_offre(p_menu_jour bigint, p_prix integer, p_fin timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_menu public.menus_jour;
  v_prix_plat integer;
begin
  perform set_config('app.operation', 'lancer_offre', true);
  if prive.mon_role() is distinct from 'admin' then
    perform prive.refuser('Seul un administrateur peut lancer une offre.');
  end if;
  select * into v_menu from public.menus_jour where id = p_menu_jour for update;
  if not found or v_menu.jour <> public.aujourdhui() then
    perform prive.refuser('Une offre ne concerne qu''un plat du jour.');
  end if;
  select prix into v_prix_plat from public.plats where id = v_menu.plat_id;
  if p_prix <= 0 or p_prix >= v_prix_plat then
    perform prive.refuser('Le prix de l''offre doit être inférieur au prix normal.');
  end if;
  if p_fin <= now() then perform prive.refuser('L''heure de fin doit être dans le futur.'); end if;
  update public.menus_jour set prix_offre = p_prix, fin_offre = p_fin where id = p_menu_jour;
end;
$$;

-- -----------------------------------------------------------------------------
-- Droits d'exécution : les fonctions métier sont ouvertes aux connectés uniquement
-- (chacune vérifie elle-même le rôle). Les fonctions internes restent fermées.
-- -----------------------------------------------------------------------------
revoke execute on function prive.refuser(text) from public, anon, authenticated;
revoke execute on function prive.nouveau_code_court(date) from public, anon, authenticated;
revoke execute on function prive.mon_role() from public, anon, authenticated;
revoke execute on function public.heure_limite(date) from public, anon;
grant execute on function public.heure_limite(date) to authenticated;

grant execute on function public.menu_periode(date, date) to authenticated;
grant execute on function public.creneaux_jour(date) to authenticated;
grant execute on function public.reserver(bigint, smallint) to authenticated;
grant execute on function public.annuler(bigint) to authenticated;
grant execute on function public.recharger(integer, public.moyen_paiement) to authenticated;
grant execute on function public.servir(text) to authenticated;
grant execute on function public.noter(bigint, smallint, text) to authenticated;
grant execute on function public.lancer_offre(bigint, integer, timestamptz) to authenticated;
revoke execute on function public.menu_periode(date, date), public.creneaux_jour(date),
  public.reserver(bigint, smallint), public.annuler(bigint), public.recharger(integer, public.moyen_paiement),
  public.servir(text), public.noter(bigint, smallint, text), public.lancer_offre(bigint, integer, timestamptz)
  from public, anon;
