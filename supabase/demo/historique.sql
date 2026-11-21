-- =============================================================================
-- Historique de démonstration : recharges, repas servis, notes et une absence
-- pour Awa (compte du pitch), et un crédit de départ pour le convive de test.
-- Rejouable : ne fait rien si l'historique existe déjà.
-- Lancement : supabase db query --remote --yes -f supabase/demo/historique.sql
-- =============================================================================
do $$
declare
  v_awa uuid := (select id from public.profils where email = 'awa.kouassi@cantine-vatel.test');
  v_test uuid := (select id from public.profils where email = 'etudiant.test@cantine-vatel.test');
  v_solde integer := 0;
  v_jour date;
  v_menu record;
  v_res bigint;
  v_i integer := 0;
  v_creneau smallint := (select id from public.creneaux where heure_debut = '12:45');
begin
  perform set_config('app.operation', 'donnees_demo', true);
  if v_awa is null or exists (select 1 from public.transactions where utilisateur_id = v_awa) then
    raise notice 'Historique déjà présent ou compte absent : rien à faire.';
    return;
  end if;

  -- Recharges Mobile Money (simulées).
  v_solde := 10000;
  insert into public.transactions (utilisateur_id, type, montant, moyen, solde_apres, cree_le)
  values (v_awa, 'recharge', 10000, 'wave', v_solde, (public.aujourdhui() - 22) + time '09:12');

  for v_jour in
    select d::date from generate_series(public.aujourdhui() - 21, public.aujourdhui() - 1, interval '1 day') d
    where extract(isodow from d) <= 5
  loop
    v_i := v_i + 1;
    if v_i = 8 then
      v_solde := v_solde + 10000;
      insert into public.transactions (utilisateur_id, type, montant, moyen, solde_apres, cree_le)
      values (v_awa, 'recharge', 10000, 'orange_money', v_solde, v_jour + time '07:40');
    end if;
    continue when v_i % 4 = 0;  -- quelques jours sans réservation

    select m.id, p.prix, p.nom into v_menu
    from public.menus_jour m join public.plats p on p.id = m.plat_id
    where m.jour = v_jour and p.type = 'plat' and not ('arachide' = any (p.allergenes))
    order by md5(v_jour::text || p.nom) limit 1;
    continue when not found or v_solde < v_menu.prix;

    v_solde := v_solde - v_menu.prix;
    insert into public.reservations (utilisateur_id, menu_jour_id, creneau_id, jour, prix_paye, statut,
      jeton_qr, code_court, scanne_le, remis_le, cree_le)
    values (v_awa, v_menu.id, v_creneau, v_jour, v_menu.prix,
      case when v_i = 6 then 'reservee'::public.statut_reservation else 'servie' end,  -- une absence
      replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
      'VTL-' || lpad((1000 + v_i)::text, 4, '0'),
      case when v_i = 6 then null else v_jour + time '12:47' end,
      case when v_i = 6 then null else v_jour + time '12:47' end,
      (v_jour - 1) + time '19:30')
    returning id into v_res;
    insert into public.transactions (utilisateur_id, type, montant, reservation_id, solde_apres, cree_le)
    values (v_awa, 'debit', v_menu.prix, v_res, v_solde, (v_jour - 1) + time '19:30');

    if v_i <> 6 and v_i % 3 <> 0 then
      insert into public.notes (reservation_id, valeur, commentaire, cree_le)
      values (v_res, 3 + (v_i % 3), case when v_i % 2 = 0 then 'Très bon, bien servi.' end, v_jour + time '13:30');
    end if;
  end loop;

  update public.profils set solde = v_solde where id = v_awa;

  -- Crédit de départ pour le convive de test (le jury peut réserver tout de suite).
  if v_test is not null and not exists (select 1 from public.transactions where utilisateur_id = v_test) then
    insert into public.transactions (utilisateur_id, type, montant, moyen, solde_apres)
    values (v_test, 'recharge', 10000, 'simule', 10000);
    update public.profils set solde = 10000 where id = v_test;
  end if;
end $$;
