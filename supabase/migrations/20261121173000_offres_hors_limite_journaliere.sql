-- =============================================================================
-- Décision d'Ali : les offres flash anti-gaspillage ne comptent pas dans la règle
-- « un repas par jour ». Les restes doivent pouvoir partir, même vers quelqu'un
-- qui a déjà mangé, et plusieurs fois. La réservation normale reste limitée à
-- une par jour, avant 8h le jour même.
-- =============================================================================
drop index public.un_repas_par_jour;
create unique index un_repas_par_jour on public.reservations (utilisateur_id, jour)
  where statut <> 'annulee' and not est_offre;

create or replace function public.reserver(p_menu_jour bigint, p_creneau smallint)
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
  v_creneau public.creneaux;
  v_pris integer;
  v_res public.reservations;
begin
  perform set_config('app.operation', 'reserver', true);
  if v_uid is null then perform prive.refuser('Veuillez vous connecter.'); end if;

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

  select * into v_creneau from public.creneaux where id = p_creneau and actif for update;
  if not found then perform prive.refuser('Créneau inconnu.'); end if;
  if now() >= public.fin_creneau(v_menu.jour, v_creneau.heure_debut) then
    perform prive.refuser('Ce créneau est déjà passé, choisissez-en un autre.');
  end if;
  select count(*) into v_pris from public.reservations
   where creneau_id = p_creneau and jour = v_menu.jour and statut <> 'annulee';
  if v_pris >= v_creneau.capacite then perform prive.refuser('Ce créneau est complet, choisissez-en un autre.'); end if;

  -- Un seul repas réservé normalement par jour. Les offres anti-gaspillage n'entrent pas
  -- dans cette limite : on peut en acheter même après avoir mangé, et plusieurs fois.
  if not v_offre and exists (select 1 from public.reservations
             where utilisateur_id = v_uid and jour = v_menu.jour and statut <> 'annulee' and not est_offre) then
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
revoke execute on function public.reserver(bigint, smallint) from public, anon;
grant execute on function public.reserver(bigint, smallint) to authenticated;
