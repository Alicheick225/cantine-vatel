-- =============================================================================
-- Test de l'espace parent : liaison par code, confidentialité, recharge de l'enfant.
-- Transaction ANNULÉE à la fin : aucune trace dans la base.
-- Lancement : supabase db query --remote --yes -f supabase/tests/parent.sql
-- =============================================================================
begin;
create temp table resultats (n serial, critere text, test text, resultat text) on commit drop;
grant all on resultats to authenticated;
grant usage on sequence resultats_n_seq to authenticated;
create temp table ctx (cle text primary key, val text) on commit drop;
grant all on ctx to authenticated;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000e1', 'enfant.test@exemple.ci', '{"nom":"Enfant Test","categorie":"etudiant"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000e2', 'autre.test@exemple.ci', '{"nom":"Autre Élève","categorie":"etudiant"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f1', 'parent.test@exemple.ci', '{"nom":"Parent Test","role":"parent"}', 'authenticated', 'authenticated');

insert into resultats (critere, test, resultat)
select 'Confidentialité', 'Inscription parent : rôle parent, jamais admin',
       case when role = 'parent' then 'OK' else 'ÉCHEC : ' || role end
from public.profils where id = '00000000-0000-0000-0000-0000000000f1';

set local role authenticated;

-- L'enfant génère son code.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
insert into ctx select 'code', public.generer_code_liaison() ->> 'code';

-- Le parent.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated"}', true);

insert into resultats (critere, test, resultat)
select 'Confidentialité', 'Avant liaison, le parent ne voit que son propre profil',
       case when count(*) = 1 then 'OK' else 'ÉCHEC : ' || count(*) end from public.profils;

insert into resultats (critere, test, resultat)
select 'Intégrité', 'Code de liaison invalide refusé',
       case when (public.lier_enfant('ZZZZZZ') ->> 'ok')::boolean = false then 'OK' else 'ÉCHEC' end;

insert into resultats (critere, test, resultat)
select 'Métier', 'Liaison avec le bon code',
       case when (public.lier_enfant((select val from ctx where cle = 'code')) ->> 'ok')::boolean then 'OK' else 'ÉCHEC' end;

insert into resultats (critere, test, resultat)
select 'Confidentialité', 'Après liaison, le parent voit son enfant et seulement lui',
       case when count(*) = 2 and bool_or(nom = 'Enfant Test') and not bool_or(nom = 'Autre Élève') then 'OK' else 'ÉCHEC : ' || string_agg(nom, ', ') end
from public.profils;

do $$
declare v json; m text;
begin
  v := public.recharger_enfant('00000000-0000-0000-0000-0000000000e1', 5000, 'wave');
  insert into resultats (critere, test, resultat) values ('Métier', 'Le parent recharge le compte de son enfant (5 000 F)',
    case when (v ->> 'solde')::int = 5000 then 'OK' else 'ÉCHEC : ' || v::text end);
  begin
    perform public.recharger_enfant('00000000-0000-0000-0000-0000000000e2', 5000, 'wave');
    m := 'ÉCHEC : recharge acceptée';
  exception when others then m := case when sqlerrm like '%enfants liés%' then 'OK' else 'ÉCHEC : ' || sqlerrm end;
  end;
  insert into resultats (critere, test, resultat) values ('Confidentialité', 'Le parent ne peut pas recharger un élève non lié', m);
  begin
    perform public.reserver((select id from public.menus_jour limit 1), (select id from public.creneaux limit 1));
    m := 'ÉCHEC';
  exception when others then m := case when sqlerrm like '%convives%' then 'OK' else 'ÉCHEC : ' || sqlerrm end;
  end;
  insert into resultats (critere, test, resultat) values ('Intégrité', 'Un parent ne peut pas réserver à sa place', m);
end $$;

reset role;

insert into resultats (critere, test, resultat)
select 'Traçabilité', 'Recharge par le parent tracée (payée par le parent, au profit de l''enfant)',
       case when count(*) = 1 then 'OK' else 'ÉCHEC : ' || count(*) end
from public.transactions
where utilisateur_id = '00000000-0000-0000-0000-0000000000e1' and cree_par = '00000000-0000-0000-0000-0000000000f1';

insert into resultats (critere, test, resultat)
select 'Traçabilité', 'Le code invalide est journalisé comme refus',
       case when count(*) = 1 then 'OK' else 'ÉCHEC : ' || count(*) end
from public.journal_audit where action = 'REFUS' and operation = 'lier_enfant' and horodatage = now();

select critere, test, resultat from resultats order by n;
rollback;
