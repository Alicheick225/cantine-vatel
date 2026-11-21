-- =============================================================================
-- Test de sécurité (critères DICT) : confidentialité, intégrité, traçabilité.
-- Tout s'exécute dans une transaction ANNULÉE à la fin : aucune trace dans la base.
-- Lancement : supabase db query --remote -f supabase/tests/securite.sql
-- Chaque ligne du résultat doit afficher « OK ».
-- =============================================================================
begin;

create temp table resultats (n serial, critere text, test text, resultat text) on commit drop;
grant all on resultats to authenticated;
grant usage on sequence resultats_n_seq to authenticated;

-- Deux comptes de test. B tente de s'inscrire en admin via les métadonnées.
insert into auth.users (id, email, raw_user_meta_data, aud, role)
values
  ('00000000-0000-0000-0000-00000000000a', 'test.a@exemple.ci', '{"nom":"Awa Test","categorie":"etudiant"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-00000000000b', 'test.b@exemple.ci', '{"nom":"Koné Test","categorie":"personnel","role":"admin"}', 'authenticated', 'authenticated');

insert into resultats (critere, test, resultat)
select 'Confidentialité', 'Inscription en admin impossible (B reste convive)',
       case when role = 'convive' and categorie = 'personnel' then 'OK' else 'ÉCHEC : ' || role end
from public.profils where id = '00000000-0000-0000-0000-00000000000b';

insert into resultats (critere, test, resultat)
select 'Traçabilité', 'Création du profil journalisée (qui, quoi, comment)',
       case when count(*) = 2 and bool_and(operation = 'inscription') then 'OK' else 'ÉCHEC' end
from public.journal_audit where table_nom = 'profils' and action = 'INSERT'
  and ligne_id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b');

-- Une recharge de test pour A (faite par la base, comme le fera la fonction recharger).
insert into public.transactions (utilisateur_id, type, montant, moyen, solde_apres)
values ('00000000-0000-0000-0000-00000000000a', 'recharge', 5000, 'simule', 5000);

-- On se connecte en A (convive étudiant).
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

insert into resultats (critere, test, resultat)
select 'Confidentialité', 'A ne voit que son propre profil',
       case when count(*) = 1 then 'OK' else 'ÉCHEC : ' || count(*) || ' profils visibles' end
from public.profils;

insert into resultats (critere, test, resultat)
select 'Confidentialité', 'A ne peut pas lire le journal d''audit',
       case when count(*) = 0 then 'OK' else 'ÉCHEC' end from public.journal_audit;

do $$
declare
  v text;
begin
  -- Intégrité : A tente de se créditer 99 999 F.
  begin
    update public.profils set solde = 99999 where id = auth.uid();
    v := 'ÉCHEC : solde modifié';
  exception when insufficient_privilege then v := 'OK';
  end;
  insert into resultats (critere, test, resultat) values ('Intégrité', 'A ne peut pas modifier son solde', v);

  -- Intégrité : A tente de devenir admin.
  begin
    update public.profils set role = 'admin' where id = auth.uid();
    v := 'ÉCHEC : rôle modifié';
  exception when insufficient_privilege then v := 'OK';
  end;
  insert into resultats (critere, test, resultat) values ('Intégrité', 'A ne peut pas changer son rôle', v);

  -- Intégrité : A tente de créer un plat.
  begin
    insert into public.plats (nom, prix) values ('Plat pirate', 1);
    v := 'ÉCHEC : plat créé';
  exception when insufficient_privilege then v := 'OK';
  end;
  insert into resultats (critere, test, resultat) values ('Intégrité', 'A ne peut pas créer de plat', v);

  -- Intégrité : A tente d'écrire une transaction directement.
  begin
    insert into public.transactions (utilisateur_id, type, montant, moyen, solde_apres)
    values (auth.uid(), 'recharge', 99999, 'simule', 99999);
    v := 'ÉCHEC : transaction écrite';
  exception when insufficient_privilege then v := 'OK';
  end;
  insert into resultats (critere, test, resultat) values ('Intégrité', 'A ne peut pas écrire de transaction', v);

  -- Traçabilité : A modifie son nom ; la base note qui et quand.
  update public.profils set nom = 'Awa Kouassi' where id = auth.uid();
  select case when modifie_par = auth.uid() and modifie_le is not null then 'OK' else 'ÉCHEC' end
    into v from public.profils where id = auth.uid();
  insert into resultats (critere, test, resultat) values ('Traçabilité', 'Modification horodatée et signée par la base', v);
end $$;

reset role;

do $$
declare
  v text;
begin
  -- Intégrité : même la base refuse de modifier une transaction (ajout seul).
  begin
    update public.transactions set montant = 1 where utilisateur_id = '00000000-0000-0000-0000-00000000000a';
    v := 'ÉCHEC : transaction modifiée';
  exception when insufficient_privilege then v := 'OK';
  end;
  insert into resultats (critere, test, resultat) values ('Intégrité', 'Transactions en ajout seul (même pour l''administrateur de la base)', v);

  -- Traçabilité : le journal d'audit est immuable.
  begin
    delete from public.journal_audit;
    v := 'ÉCHEC : journal effacé';
  exception when insufficient_privilege then v := 'OK';
  end;
  insert into resultats (critere, test, resultat) values ('Traçabilité', 'Journal d''audit impossible à effacer', v);
end $$;

insert into resultats (critere, test, resultat)
select 'Traçabilité', 'Ancienne et nouvelle valeur conservées dans le journal',
       case when count(*) >= 1 then 'OK' else 'ÉCHEC' end
from public.journal_audit
where table_nom = 'profils' and action = 'UPDATE'
  and anciennes_valeurs ->> 'nom' = 'Awa Test' and nouvelles_valeurs ->> 'nom' = 'Awa Kouassi';

select critere, test, resultat from resultats order by n;

rollback;
