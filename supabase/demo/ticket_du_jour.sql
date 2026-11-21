-- =============================================================================
-- Ticket du jour pour la démo au comptoir (à lancer le matin du pitch, après 8h).
-- Crée une réservation du jour pour Awa (kédjénou si au menu, créneau 12h45)
-- et débite son solde, comme le ferait la fonction reserver.
-- Lancement : supabase db query --remote --yes -f supabase/demo/ticket_du_jour.sql
-- =============================================================================
do $$
declare
  v_awa uuid := (select id from public.profils where email = 'awa.kouassi@cantine-vatel.test');
  v_menu record;
  v_res bigint;
  v_solde integer;
begin
  perform set_config('app.operation', 'donnees_demo', true);
  if exists (select 1 from public.reservations where utilisateur_id = v_awa
             and jour = public.aujourdhui() and statut <> 'annulee') then
    raise notice 'Awa a déjà un ticket aujourd''hui.';
    return;
  end if;

  select m.id, p.prix into v_menu
  from public.menus_jour m join public.plats p on p.id = m.plat_id
  where m.jour = public.aujourdhui() and p.type = 'plat'
  order by (p.nom = 'Kédjénou de poulet') desc, p.prix desc limit 1;
  if not found then raise exception 'Aucun menu aujourd''hui.'; end if;

  select solde into v_solde from public.profils where id = v_awa for update;
  if v_solde < v_menu.prix then raise exception 'Solde d''Awa insuffisant.'; end if;

  insert into public.reservations (utilisateur_id, menu_jour_id, creneau_id, jour, prix_paye, jeton_qr, code_court)
  values (v_awa, v_menu.id, (select id from public.creneaux where heure_debut = '12:45'), public.aujourdhui(),
          v_menu.prix, replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
          prive.nouveau_code_court(public.aujourdhui()))
  returning id into v_res;
  update public.profils set solde = solde - v_menu.prix where id = v_awa returning solde into v_solde;
  insert into public.transactions (utilisateur_id, type, montant, reservation_id, solde_apres)
  values (v_awa, 'debit', v_menu.prix, v_res, v_solde);
end $$;
