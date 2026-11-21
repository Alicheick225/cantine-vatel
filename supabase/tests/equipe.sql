-- =============================================================================
-- Test des rôles d'équipe : super-admin, scanneur (entrée), serveur (passe).
-- Moindre privilège : chacun ne peut faire que son geste. Transaction ANNULÉE à la fin.
-- Lancement : supabase db query --remote --yes -f supabase/tests/equipe.sql
-- =============================================================================
begin;
create temp table resultats (n serial, critere text, test text, resultat text) on commit drop;
grant all on resultats to authenticated;
grant usage on sequence resultats_n_seq to authenticated;
create temp table ctx (cle text primary key, val text) on commit drop;
grant all on ctx to authenticated;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000a7', 'convive.eq@exemple.ci', '{"nom":"Koffi Test","categorie":"etudiant"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b7', 'scan.eq@exemple.ci', '{"nom":"Aya Scan","categorie":"personnel"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c7', 'passe.eq@exemple.ci', '{"nom":"Mariam Passe","categorie":"personnel"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d7', 'admin.eq@exemple.ci', '{"nom":"Admin Équipe"}', 'authenticated', 'authenticated');
update public.profils set role = 'admin', categorie = null where id = '00000000-0000-0000-0000-0000000000d7';

with c as (insert into public.creneaux (heure_debut, capacite) values ('06:17', 5) returning id),
     p as (insert into public.plats (nom, prix, allergenes) values ('Plat équipe test', 1000, '{arachide}') returning id)
insert into ctx select 'creneau', (select id from c)::text union all select 'plat', (select id from p)::text;
insert into public.menus_jour (jour, plat_id, portions_prevues)
select public.aujourdhui(), val::bigint, 10 from ctx where cle = 'plat';
insert into public.reservations (utilisateur_id, menu_jour_id, creneau_id, jour, prix_paye, jeton_qr, code_court)
select '00000000-0000-0000-0000-0000000000a7',
       (select id from public.menus_jour where jour = public.aujourdhui() and plat_id = (select val::bigint from ctx where cle = 'plat')),
       (select val::smallint from ctx where cle = 'creneau'), public.aujourdhui(), 1000,
       'jetonequipe00000000000000000000000000000000000000000000000000000', 'VTL-9077';

set local role authenticated;

-- ===== Super-admin : nomme l'équipe =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d7","role":"authenticated"}', true);
do $$
declare v json; m text;
begin
  v := public.definir_role('scan.eq@exemple.ci', 'scanneur');
  perform public.definir_role('PASSE.EQ@exemple.ci', 'serveur');
  insert into resultats (critere, test, resultat) values ('Métier', 'Le super-admin nomme une scanneuse et une serveuse (email sans tenir compte des majuscules)',
    case when (v ->> 'ok')::boolean
              and (select role from public.profils where id = '00000000-0000-0000-0000-0000000000b7') = 'scanneur'
              and (select role from public.profils where id = '00000000-0000-0000-0000-0000000000c7') = 'serveur' then 'OK' else 'ÉCHEC : ' || v::text end);

  begin perform public.definir_role('convive.eq@exemple.ci', 'admin'); m := 'ÉCHEC : admin créé';
  exception when others then m := case when sqlerrm like '%ne peut pas être attribué%' then 'OK' else 'ÉCHEC : ' || sqlerrm end; end;
  insert into resultats (critere, test, resultat) values ('Intégrité', 'Impossible de créer un administrateur depuis l''application', m);

  begin perform public.definir_role('admin.eq@exemple.ci', 'serveur'); m := 'ÉCHEC : rôle changé';
  exception when others then m := case when sqlerrm like '%propre rôle%' then 'OK' else 'ÉCHEC : ' || sqlerrm end; end;
  insert into resultats (critere, test, resultat) values ('Intégrité', 'L''admin ne peut pas changer son propre rôle', m);

  v := public.definir_role('inconnu.eq@exemple.ci', 'serveur');
  insert into resultats (critere, test, resultat) values ('Traçabilité', 'Email inconnu : refus expliqué et journalisé',
    case when (v ->> 'ok')::boolean = false then 'OK' else 'ÉCHEC : ' || v::text end);
end $$;

-- ===== Scanneuse : valide l'entrée, ne remet pas, ne gère rien =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b7","role":"authenticated"}', true);
do $$
declare v json; m text;
begin
  -- Même si elle demande « je scanne et je sers », la base force la validation d'entrée.
  v := public.servir('VTL-9077', true);
  insert into ctx values ('resa', v -> 'ticket' ->> 'reservation_id');
  insert into ctx values ('scan_ok', ((v ->> 'ok')::boolean and (v ->> 'envoye_au_passe')::boolean)::text);

  begin perform public.remettre((select val::bigint from ctx where cle = 'resa')); m := 'ÉCHEC : remise acceptée';
  exception when others then m := case when sqlerrm like '%équipe du passe%' then 'OK' else 'ÉCHEC : ' || sqlerrm end; end;
  insert into resultats (critere, test, resultat) values ('Confidentialité', 'Scanneuse : ne peut pas confirmer une remise', m);

  begin perform public.definir_role('convive.eq@exemple.ci', 'serveur'); m := 'ÉCHEC : rôle attribué';
  exception when others then m := case when sqlerrm like '%administrateur%' then 'OK' else 'ÉCHEC : ' || sqlerrm end; end;
  insert into resultats (critere, test, resultat) values ('Confidentialité', 'Scanneuse : ne peut pas nommer l''équipe', m);

  begin perform public.tableau_bord(public.aujourdhui()); m := 'ÉCHEC : tableau de bord lu';
  exception when others then m := 'OK'; end;
  insert into resultats (critere, test, resultat) values ('Confidentialité', 'Scanneuse : pas d''accès au tableau de bord ni aux recettes', m);

  insert into resultats (critere, test, resultat)
  select 'Confidentialité', 'Scanneuse : ne lit ni les profils ni les réservations des autres',
         case when (select count(*) from public.profils) = 1 and (select count(*) from public.reservations) = 0 then 'OK' else 'ÉCHEC' end;
end $$;

-- ===== Serveuse : voit la file du passe et remet, rien d'autre =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c7","role":"authenticated"}', true);
do $$
declare v json; m text;
begin
  v := public.file_du_passe();
  insert into resultats (critere, test, resultat) values ('Métier', 'Serveuse : la file du passe montre le ticket, le plat et l''allergie, sans email ni jeton',
    case when json_array_length(v) >= 1 and v::text like '%VTL-9077%' and v::text like '%arachide%'
              and v::text not like '%@%' and v::text not like '%jetonequipe%' then 'OK' else 'ÉCHEC : ' || v::text end);

  begin perform public.servir('VTL-9077', false); m := 'ÉCHEC : scan accepté';
  exception when others then m := case when sqlerrm like '%équipe du comptoir%' then 'OK' else 'ÉCHEC : ' || sqlerrm end; end;
  insert into resultats (critere, test, resultat) values ('Confidentialité', 'Serveuse : ne peut pas valider un ticket à l''entrée', m);

  -- État vérifié plus bas, hors de son rôle : elle ne lit pas la table des réservations.
  insert into ctx select 'remis_avant', remis_le is not null from public.reservations where id = (select val::bigint from ctx where cle = 'resa');
  perform public.remettre((select val::bigint from ctx where cle = 'resa'));
end $$;

-- ===== Le convive ne peut rien faire de tout cela =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a7","role":"authenticated"}', true);
do $$
declare m text;
begin
  begin perform public.file_du_passe(); m := 'ÉCHEC : file lue';
  exception when others then m := case when sqlerrm like '%équipe du passe%' then 'OK' else 'ÉCHEC : ' || sqlerrm end; end;
  insert into resultats (critere, test, resultat) values ('Confidentialité', 'Un convive ne voit pas la file du passe', m);

  begin update public.profils set role = 'scanneur' where id = '00000000-0000-0000-0000-0000000000a7'; m := 'ÉCHEC : rôle modifié';
  exception when others then m := 'OK'; end;
  insert into resultats (critere, test, resultat) values ('Intégrité', 'Un convive ne peut pas se nommer scanneur lui-même', m);
end $$;

reset role;

-- Vérifications d'état, avec les droits du propriétaire de la base.
insert into ctx select 'scanne_sans_remise', (scanne_le is not null)::text from public.reservations where id = (select val::bigint from ctx where cle = 'resa');
insert into resultats (critere, test, resultat)
select 'Confidentialité', 'Scanneuse : le ticket est validé et envoyé au passe, jamais marqué remis par elle',
       case when (select val from ctx where cle = 'scan_ok') = 'true' and (select val from ctx where cle = 'scanne_sans_remise') = 'true'
                 and not exists (select 1 from ctx where cle = 'remis_avant' and val = 'true') then 'OK' else 'ÉCHEC' end;
insert into resultats (critere, test, resultat)
select 'Métier', 'Serveuse : confirme la remise (remis à rempli)',
       case when remis_le is not null then 'OK' else 'ÉCHEC' end
from public.reservations where id = (select val::bigint from ctx where cle = 'resa');

insert into resultats (critere, test, resultat)
select 'Traçabilité', 'Chaque nomination est tracée (qui, quoi, opération definir_role)',
       case when count(*) = 2 then 'OK' else 'ÉCHEC : ' || count(*) end
from public.journal_audit
where operation = 'definir_role' and action = 'UPDATE' and table_nom = 'profils' and horodatage = now()
  and acteur = '00000000-0000-0000-0000-0000000000d7';

select critere, test, resultat from resultats order by n;
rollback;
