-- =============================================================================
-- Écran du passe (configuration 2 du comptoir) : une personne scanne à l'entrée
-- de la file, une autre sert au passe et confirme la remise.
--   servir(code, p_remettre) : p_remettre = true (configuration 1) remplit « scanné à » et « remis à » ;
--                              p_remettre = false (configuration 2) ne remplit que « scanné à ».
--   remettre(réservation)    : le passe confirme que le plat a été remis.
-- =============================================================================
drop function public.servir(text);

create function public.servir(p_code text, p_remettre boolean default true)
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
  perform set_config('app.operation', case when p_remettre then 'servir' else 'valider_entree' end, true);
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
     set statut = 'servie', scanne_le = now(), servi_par = auth.uid(),
         remis_le = case when p_remettre then now() end
   where id = v_res.id;
  return json_build_object('ok', true, 'ticket', v_info, 'envoye_au_passe', not p_remettre);
end;
$$;

create function public.remettre(p_reservation bigint)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res public.reservations;
begin
  perform set_config('app.operation', 'remettre', true);
  if prive.mon_role() is distinct from 'admin' then
    perform prive.refuser('Seul un administrateur peut confirmer une remise.');
  end if;
  select * into v_res from public.reservations where id = p_reservation for update;
  if not found or v_res.scanne_le is null then
    perform prive.refuser('Ce ticket n''a pas été validé à l''entrée.');
  end if;
  if v_res.remis_le is not null then perform prive.refuser('Ce plat a déjà été remis.'); end if;
  update public.reservations set remis_le = now() where id = p_reservation;
end;
$$;

revoke execute on function public.servir(text, boolean), public.remettre(bigint) from public, anon;
grant execute on function public.servir(text, boolean), public.remettre(bigint) to authenticated;
