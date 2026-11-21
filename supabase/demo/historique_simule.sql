-- =============================================================================
-- Historique simulé de 6 semaines pour la prévision (aucune donnée réelle fournie).
-- 150 convives fictifs (sans mot de passe : impossible de se connecter),
-- fréquentation réaliste : mercredi et vendredi plus calmes, plats plus ou moins
-- populaires, ~10 % d'absences, notes. Chaque solde = somme de ses transactions.
-- Rejouable : ne fait rien si l'historique simulé existe déjà.
-- Lancement : supabase db query --remote --yes -f supabase/demo/historique_simule.sql
-- =============================================================================
do $$
declare
  v_jour date;
  v_user record;
  v_menu record;
  v_proba numeric;
  v_res bigint;
  v_absent boolean;
  v_creneau smallint;
  v_n integer := 0;
begin
  perform set_config('app.operation', 'donnees_demo', true);
  if exists (select 1 from auth.users where email like 'convive.sim%@cantine-vatel.test') then
    raise notice 'Historique simulé déjà présent.';
    return;
  end if;
  perform setseed(0.42);

  -- 150 convives fictifs : 110 étudiants, 40 membres du personnel.
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated',
         format('convive.sim%s@cantine-vatel.test', lpad(i::text, 3, '0')),
         '{"provider":"email","providers":["email"]}',
         json_build_object('nom', format('Convive simulé %s', lpad(i::text, 3, '0')),
                           'categorie', case when i <= 110 then 'etudiant' else 'personnel' end)::jsonb,
         now(), now(), '', '', '', ''
  from generate_series(1, 150) i;

  -- Recharge de départ (Wave ou Orange Money), six semaines en arrière.
  for v_user in select id from public.profils where email like 'convive.sim%' loop
    insert into public.transactions (utilisateur_id, type, montant, moyen, solde_apres, cree_le)
    values (v_user.id, 'recharge', 100000,
            case when random() < 0.6 then 'wave' else 'orange_money' end::public.moyen_paiement,
            100000, (public.aujourdhui() - 43) + time '08:00');
    update public.profils set solde = 100000 where id = v_user.id;
  end loop;

  -- Jours ouvrés passés : chaque convive réserve avec une probabilité selon le jour.
  for v_jour in
    select d::date from generate_series(public.aujourdhui() - 42, public.aujourdhui() - 1, interval '1 day') d
    where extract(isodow from d) <= 5
  loop
    v_proba := case extract(isodow from v_jour)
                 when 1 then 0.80 when 2 then 0.85 when 3 then 0.55 when 4 then 0.82 else 0.65 end;
    for v_user in select id, solde from public.profils where email like 'convive.sim%' loop
      continue when random() > v_proba;
      -- Choix du plat pondéré par sa popularité.
      select m.id, p.prix into v_menu
      from public.menus_jour m join public.plats p on p.id = m.plat_id
      where m.jour = v_jour and p.type = 'plat'
      order by random() * case p.nom
        when 'Garba' then 3.0 when 'Kédjénou de poulet' then 2.4 when 'Alloco poulet braisé' then 2.2
        when 'Attiéké poisson braisé' then 1.8 when 'Riz sauce graine' then 1.4 when 'Placali sauce kopè' then 0.9
        else 0.6 end desc
      limit 1;
      continue when not found or v_user.solde < v_menu.prix;

      v_absent := random() < 0.10;
      v_creneau := (select id from public.creneaux order by abs(extract(epoch from heure_debut - time '12:30')) + random() * 3600 limit 1);
      insert into public.reservations (utilisateur_id, menu_jour_id, creneau_id, jour, prix_paye, statut,
                                       jeton_qr, code_court, scanne_le, remis_le, cree_le)
      values (v_user.id, v_menu.id, v_creneau, v_jour, v_menu.prix,
              case when v_absent then 'reservee' else 'servie' end::public.statut_reservation,
              replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''),
              prive.nouveau_code_court(v_jour),
              case when v_absent then null else v_jour + time '12:30' + random() * interval '75 minutes' end,
              case when v_absent then null else v_jour + time '12:30' + random() * interval '75 minutes' end,
              (v_jour - 1) + time '18:00' + random() * interval '13 hours')
      returning id into v_res;
      update public.profils set solde = solde - v_menu.prix where id = v_user.id;
      insert into public.transactions (utilisateur_id, type, montant, reservation_id, solde_apres, cree_le)
      values (v_user.id, 'debit', v_menu.prix, v_res, v_user.solde - v_menu.prix, (v_jour - 1) + time '20:00');
      if not v_absent and random() < 0.35 then
        insert into public.notes (reservation_id, valeur, cree_le)
        values (v_res, least(5, greatest(1, round(3.9 + random() * 1.6 - 0.5)))::smallint, v_jour + time '14:00');
      end if;
      v_n := v_n + 1;
    end loop;
  end loop;

  -- Portions préparées : un peu plus que les réservations (gaspillage visible), en baisse sur les dernières semaines.
  update public.menus_jour m
     set portions_preparees = r.nb + greatest(2, round((r.nb * 0.25) * (1 - (public.aujourdhui() - m.jour) / 84.0 * -1) * 0.8))::int
    from (select menu_jour_id, count(*) nb from public.reservations where statut <> 'annulee' group by menu_jour_id) r
   where r.menu_jour_id = m.id and m.jour < public.aujourdhui();

  raise notice '% réservations simulées', v_n;
end $$;
