-- =============================================================================
-- Tickets de test pour le comptoir : un ticket par cas de l'écran vert / rouge.
-- Relançable à volonté : remet les tickets VTL-9101 à VTL-9107 dans leur état de départ
-- (un ticket scanné redevient « à servir »). Les QR codes restent les mêmes d'un lancement à l'autre.
-- Convives fictifs, sans mot de passe : personne ne peut se connecter avec ces comptes.
-- Tout est marqué « donnees_demo » dans le journal d'audit.
-- Lancement : supabase db query --remote --yes -f supabase/demo/tickets_scan.sql
--
--   VTL-9101  ticket normal                         → VERT, envoyé au passe
--   VTL-9102  allergique au poisson, plat au poisson → VERT + alerte allergène
--   VTL-9103  convive végétarien                    → VERT + badge Végétarien
--   VTL-9104  offre anti-gaspi                       → VERT
--   VTL-9105  ticket annulé                          → ROUGE « Ticket annulé »
--   VTL-9106  déjà servi à 12h10                     → ROUGE « Déjà servi à 12:10 »
--   VTL-9107  ticket d'hier                          → ROUGE « Ticket d'un autre jour »
-- =============================================================================
do $$
declare
  v_jour date := public.aujourdhui();
  v_scanneuse uuid := (select id from public.profils where email = 'scanneuse@cantine-vatel.test');
  r record;
  v_menu bigint;
  v_prix integer;
  v_profil uuid;
begin
  perform set_config('app.operation', 'donnees_demo', true);

  -- 1. Convives fictifs (créés une seule fois).
  insert into auth.users (instance_id, id, aud, role, email, raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  select '00000000-0000-0000-0000-000000000000', gen_random_uuid(), 'authenticated', 'authenticated', t.email,
         '{"provider":"email","providers":["email"]}', json_build_object('nom', t.nom, 'categorie', t.categorie)::jsonb,
         now(), now(), '', '', '', ''
  from (values
    ('scan.test1@cantine-vatel.test', 'Koffi Kouamé', 'etudiant'),
    ('scan.test2@cantine-vatel.test', 'Fatou Diabaté', 'etudiant'),
    ('scan.test3@cantine-vatel.test', 'Adjoua Yao', 'personnel'),
    ('scan.test4@cantine-vatel.test', 'Moussa Traoré', 'etudiant'),
    ('scan.test5@cantine-vatel.test', 'Aminata Koné', 'etudiant'),
    ('scan.test6@cantine-vatel.test', 'Yao Brou', 'personnel'),
    ('scan.test7@cantine-vatel.test', 'Ibrahim Ouédraogo', 'etudiant')
  ) as t(email, nom, categorie)
  where not exists (select 1 from auth.users u where u.email = t.email);

  update public.profils set allergies = '{poisson}' where email = 'scan.test2@cantine-vatel.test';
  update public.profils set vegetarien = true where email = 'scan.test3@cantine-vatel.test';

  -- 2. Un plat végétarien au menu du jour, pour le cas VTL-9103.
  insert into public.menus_jour (jour, plat_id, portions_prevues)
  select v_jour, p.id, 20 from public.plats p
  where p.nom = 'Alloco œuf'
    and not exists (select 1 from public.menus_jour m where m.jour = v_jour and m.plat_id = p.id);

  -- 3. Remise à zéro : on retire les tickets de test précédents (ils n'ont ni note ni transaction).
  delete from public.reservations where jeton_qr like 'jetontestscan%';

  -- 4. Les sept tickets.
  for r in
    select * from (values
      ('VTL-9101', 'scan.test1@cantine-vatel.test', 0, 'Kédjénou de poulet', false, 'reservee', '12:00'),
      ('VTL-9102', 'scan.test2@cantine-vatel.test', 0, 'Garba',              false, 'reservee', '12:00'),
      ('VTL-9103', 'scan.test3@cantine-vatel.test', 0, 'Alloco œuf',         false, 'reservee', '12:15'),
      ('VTL-9104', 'scan.test4@cantine-vatel.test', 0, 'Placali sauce kopè', true,  'reservee', '13:30'),
      ('VTL-9105', 'scan.test5@cantine-vatel.test', 0, 'Kédjénou de poulet', false, 'annulee',  '12:30'),
      ('VTL-9106', 'scan.test6@cantine-vatel.test', 0, 'Garba',              false, 'servie',   '12:00'),
      ('VTL-9107', 'scan.test7@cantine-vatel.test', -1, 'Kédjénou de poulet', false, 'reservee', '12:00')
    ) as t(code, email, decalage, plat, offre, statut, creneau)
  loop
    -- Le plat demandé s'il est au menu ce jour-là, sinon le premier plat du jour.
    select m.id, p.prix into v_menu, v_prix
    from public.menus_jour m join public.plats p on p.id = m.plat_id
    where m.jour = v_jour + r.decalage and p.type = 'plat'
    order by (p.nom = r.plat) desc, p.id limit 1;
    if v_menu is null then raise exception 'Aucun plat au menu le %.', v_jour + r.decalage; end if;
    v_profil := (select id from public.profils where email = r.email);

    insert into public.reservations (utilisateur_id, menu_jour_id, creneau_id, jour, prix_paye, est_offre, statut,
                                     jeton_qr, code_court, scanne_le, remis_le, servi_par, annule_le)
    values (v_profil, v_menu, (select id from public.creneaux where heure_debut = r.creneau::time), v_jour + r.decalage,
            case when r.offre then v_prix / 2 else v_prix end, r.offre, r.statut::public.statut_reservation,
            rpad('jetontestscan' || substr(r.code, 5), 64, '0'), r.code,
            case when r.statut = 'servie' then (v_jour + time '12:10') at time zone 'Africa/Abidjan' end,
            case when r.statut = 'servie' then (v_jour + time '12:12') at time zone 'Africa/Abidjan' end,
            case when r.statut = 'servie' then v_scanneuse end,
            case when r.statut = 'annulee' then now() end);
  end loop;
end $$;

select r.code_court as code, pr.nom as convive, p.nom as plat, r.jour, r.statut, r.est_offre as offre,
       pr.allergies, pr.vegetarien
from public.reservations r
join public.profils pr on pr.id = r.utilisateur_id
join public.menus_jour m on m.id = r.menu_jour_id join public.plats p on p.id = m.plat_id
where r.jeton_qr like 'jetontestscan%'
order by r.code_court;
