-- =============================================================================
-- Droits de l'équipe du comptoir (principe du moindre privilège).
--   admin    : tout (scanner, servir, gérer, nommer l'équipe) ;
--   scanneur : servir(code) en mode « entrée » uniquement : il valide, il ne remet pas ;
--   serveur  : file du passe + remettre(réservation) uniquement.
-- Seul l'admin nomme l'équipe ; personne ne peut se nommer soi-même ni créer un admin.
-- =============================================================================

-- 1. Comptoir : l'admin ou le scanneur. Le scanneur ne fait que valider l'entrée.
create or replace function public.servir(p_code text, p_remettre boolean default true)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_code text := upper(trim(p_code));
  v_role public.role_utilisateur := prive.mon_role();
  v_res public.reservations;
  v_raison text;
  v_info json;
begin
  if v_role = 'scanneur' then p_remettre := false; end if;
  perform set_config('app.operation', case when p_remettre then 'servir' else 'valider_entree' end, true);
  if v_role is null or v_role not in ('admin', 'scanneur') then
    perform prive.refuser('Seule l''équipe du comptoir peut valider un ticket.');
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
             'plat', pl.nom, 'allergenes_plat', pl.allergenes, 'convive', pr.nom, 'categorie', pr.categorie,
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
     set statut = 'servie', scanne_le = now(), servi_par = auth.uid(),
         remis_le = case when p_remettre then now() end
   where id = v_res.id;
  return json_build_object('ok', true, 'ticket', v_info, 'envoye_au_passe', not p_remettre);
end;
$$;

-- 2. Passe : l'admin ou le serveur confirme la remise.
create or replace function public.remettre(p_reservation bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.reservations;
begin
  perform set_config('app.operation', 'remettre', true);
  if prive.mon_role() is null or prive.mon_role() not in ('admin', 'serveur') then
    perform prive.refuser('Seule l''équipe du passe peut confirmer une remise.');
  end if;
  select * into v_res from public.reservations where id = p_reservation for update;
  if not found or v_res.scanne_le is null then
    perform prive.refuser('Ce ticket n''a pas été validé à l''entrée.');
  end if;
  if v_res.remis_le is not null then perform prive.refuser('Ce plat a déjà été remis.'); end if;
  update public.reservations set remis_le = now() where id = p_reservation;
end;
$$;

-- 3. File du passe : seulement ce dont le serveur a besoin (pas d'email, pas de solde, pas de jeton QR).
create function public.file_du_passe()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if prive.mon_role() is null or prive.mon_role() not in ('admin', 'serveur') then
    perform prive.refuser('Réservé à l''équipe du passe.');
  end if;
  return coalesce((
    select json_agg(json_build_object(
             'id', r.id, 'code_court', r.code_court, 'scanne_le', r.scanne_le,
             'plat', pl.nom, 'allergenes_plat', pl.allergenes,
             'convive', pr.nom, 'allergies', pr.allergies, 'vegetarien', pr.vegetarien)
           order by r.scanne_le)
    from public.reservations r
    join public.menus_jour m on m.id = r.menu_jour_id
    join public.plats pl on pl.id = m.plat_id
    join public.profils pr on pr.id = r.utilisateur_id
    where r.jour = public.aujourdhui() and r.scanne_le is not null and r.remis_le is null), '[]'::json);
end;
$$;

-- 4. Compteur du service pour l'écran du comptoir (servis / attendus), sans le reste du tableau de bord.
create function public.compteur_service()
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if prive.mon_role() is null or prive.mon_role() not in ('admin', 'scanneur', 'serveur') then
    perform prive.refuser('Réservé à l''équipe du comptoir.');
  end if;
  return (select json_build_object(
            'reservees', count(*) filter (where statut <> 'annulee'),
            'servies', count(*) filter (where statut = 'servie'))
          from public.reservations where jour = public.aujourdhui());
end;
$$;

-- 5. Nommer l'équipe : réservé à l'admin, tracé dans le journal (opération « definir_role »).
--    Rôles possibles : convive, scanneur, serveur. Jamais admin, jamais soi-même, jamais un parent.
create function public.definir_role(p_email text, p_role public.role_utilisateur)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cible public.profils;
begin
  perform set_config('app.operation', 'definir_role', true);
  if prive.mon_role() is distinct from 'admin' then
    perform prive.refuser('Seul un administrateur peut nommer l''équipe.');
  end if;
  if p_role not in ('convive', 'scanneur', 'serveur') then
    perform prive.refuser('Ce rôle ne peut pas être attribué depuis l''application.');
  end if;

  select * into v_cible from public.profils where lower(email) = lower(trim(p_email)) for update;
  if not found then
    perform public.journaliser('REFUS', 'profils', null, null, null,
                               json_build_object('raison', 'compte_inconnu', 'email', lower(trim(p_email)))::jsonb);
    return json_build_object('ok', false, 'raison', 'Aucun compte avec cet email : la personne doit d''abord créer son compte.');
  end if;
  if v_cible.id = auth.uid() then
    perform prive.refuser('Vous ne pouvez pas changer votre propre rôle.');
  end if;
  if v_cible.role in ('admin', 'parent') then
    perform prive.refuser('Le rôle d''un administrateur ou d''un parent ne se change pas ici.');
  end if;

  update public.profils
     set role = p_role,
         categorie = case when p_role = 'convive' then coalesce(categorie, 'personnel') else categorie end
   where id = v_cible.id;
  return json_build_object('ok', true, 'nom', v_cible.nom, 'role', p_role);
end;
$$;

revoke execute on function public.servir(text, boolean), public.remettre(bigint), public.file_du_passe(),
  public.compteur_service(), public.definir_role(text, public.role_utilisateur) from public, anon;
grant execute on function public.servir(text, boolean), public.remettre(bigint), public.file_du_passe(),
  public.compteur_service(), public.definir_role(text, public.role_utilisateur) to authenticated;
