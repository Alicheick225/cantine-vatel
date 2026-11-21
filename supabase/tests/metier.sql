-- =============================================================================
-- Test des règles métier : réserver, annuler, recharger, servir, noter.
-- Transaction ANNULÉE à la fin : aucune trace dans la base.
-- Lancement : supabase db query --remote --yes -f supabase/tests/metier.sql
-- =============================================================================
begin;

create temp table resultats (n serial, critere text, test text, resultat text) on commit drop;
grant all on resultats to authenticated;
grant usage on sequence resultats_n_seq to authenticated;
create temp table ctx (cle text primary key, val text) on commit drop;
grant all on ctx to authenticated;

insert into auth.users (id, email, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'awa.test@exemple.ci', '{"nom":"Awa Test","categorie":"etudiant"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d1', 'admin.test@exemple.ci', '{"nom":"Admin Test"}', 'authenticated', 'authenticated');
update public.profils set role = 'admin', categorie = null where id = '00000000-0000-0000-0000-0000000000d1';
update public.profils set allergies = '{arachide}' where id = '00000000-0000-0000-0000-0000000000a1';

with c as (insert into public.creneaux (heure_debut, capacite) values ('06:13', 5) returning id),
     p as (insert into public.plats (nom, prix, allergenes) values ('Garba test', 1000, '{poisson}') returning id)
insert into ctx
select 'creneau', (select id from c)::text
union all select 'plat', (select id from p)::text;

insert into public.menus_jour (jour, plat_id, portions_prevues)
select public.aujourdhui() + 1, val::bigint, 1 from ctx where cle = 'plat';
insert into public.menus_jour (jour, plat_id, portions_prevues)
select public.aujourdhui(), val::bigint, 10 from ctx where cle = 'plat';
insert into ctx select 'menu_demain', id::text from public.menus_jour where jour = public.aujourdhui() + 1 and plat_id = (select val::bigint from ctx where cle = 'plat');
insert into ctx select 'menu_jour', id::text from public.menus_jour where jour = public.aujourdhui() and plat_id = (select val::bigint from ctx where cle = 'plat');

-- Ticket du jour créé d'avance (comme le script de préparation de la démo).
insert into public.reservations (utilisateur_id, menu_jour_id, creneau_id, jour, prix_paye, jeton_qr, code_court)
select '00000000-0000-0000-0000-0000000000a1', (select val::bigint from ctx where cle = 'menu_jour'),
       (select val::smallint from ctx where cle = 'creneau'), public.aujourdhui(), 1000,
       'jetontestdujour0000000000000000000000000000000000000000000000000', 'VTL-9042';

-- ===== Awa (convive) =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);

do $$
declare
  v json; m text; menu_demain bigint; menu_jour bigint; cr smallint;
begin
  select val::bigint into menu_demain from ctx where cle = 'menu_demain';
  select val::bigint into menu_jour from ctx where cle = 'menu_jour';
  select val::smallint into cr from ctx where cle = 'creneau';

  begin perform public.recharger(999, 'wave'); m := 'ÉCHEC';
  exception when others then m := case when sqlerrm like '%non autorisé%' then 'OK' else 'ÉCHEC : ' || sqlerrm end; end;
  insert into resultats (critere, test, resultat) values ('Intégrité', 'Recharge d''un montant non autorisé refusée', m);

  v := public.recharger(2000, 'wave');
  insert into resultats (critere, test, resultat) values ('Métier', 'Recharge Wave simulée de 2 000 F',
    case when (v ->> 'solde')::int = 2000 then 'OK' else 'ÉCHEC : ' || v::text end);

  v := public.reserver(menu_demain, cr);
  insert into ctx values ('resa', v ->> 'reservation_id');
  insert into resultats (critere, test, resultat) values ('Métier', 'Réservation pour demain : solde débité, ticket créé',
    case when (v ->> 'solde')::int = 1000 and v ->> 'code_court' like 'VTL-%' and length(v ->> 'jeton_qr') = 64
         then 'OK' else 'ÉCHEC : ' || v::text end);

  begin perform public.reserver(menu_demain, cr); m := 'ÉCHEC';
  exception when others then m := case when sqlerrm like '%déjà un repas%' or sqlerrm like '%portion%' then 'OK' else 'ÉCHEC : ' || sqlerrm end; end;
  insert into resultats (critere, test, resultat) values ('Intégrité', 'Deuxième réservation le même jour refusée', m);

  begin perform public.reserver(menu_jour, cr); m := 'ÉCHEC';
  exception when others then m := case when sqlerrm like '%déjà un repas%' or sqlerrm like '%closes%' then 'OK' else 'ÉCHEC : ' || sqlerrm end; end;
  insert into resultats (critere, test, resultat) values ('Métier', 'Réservation du jour après 8h refusée', m);

  v := public.annuler((select val::bigint from ctx where cle = 'resa'));
  insert into resultats (critere, test, resultat) values ('Métier', 'Annulation avant la limite : remboursement intégral',
    case when (v ->> 'solde')::int = 2000 then 'OK' else 'ÉCHEC : ' || v::text end);

  begin perform public.servir('VTL-9042'); m := 'ÉCHEC';
  exception when others then m := case when sqlerrm like '%administrateur%' then 'OK' else 'ÉCHEC : ' || sqlerrm end; end;
  insert into resultats (critere, test, resultat) values ('Confidentialité', 'Un convive ne peut pas valider son propre ticket', m);
end $$;

-- ===== Admin au comptoir =====
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);

do $$
declare v json;
begin
  v := public.servir('vtl-9042');
  insert into resultats (critere, test, resultat) values ('Métier', 'Scan du ticket du jour : écran vert avec plat et allergies',
    case when (v ->> 'ok')::boolean and v -> 'ticket' ->> 'plat' = 'Garba test'
              and v -> 'ticket' -> 'allergies' ->> 0 = 'arachide' then 'OK' else 'ÉCHEC : ' || v::text end);

  v := public.servir('jetontestdujour0000000000000000000000000000000000000000000000000');
  insert into resultats (critere, test, resultat) values ('Intégrité', 'Deuxième scan (capture partagée) : écran rouge « déjà servi »',
    case when not (v ->> 'ok')::boolean and v ->> 'raison' = 'deja_servi' then 'OK' else 'ÉCHEC : ' || v::text end);

  v := public.servir('VTL-ABCD');
  insert into resultats (critere, test, resultat) values ('Intégrité', 'Code inconnu : écran rouge',
    case when v ->> 'raison' = 'inconnu' then 'OK' else 'ÉCHEC : ' || v::text end);
end $$;

reset role;

-- ===== Écran du passe (configuration 2) : validation à l'entrée, puis remise =====
insert into public.reservations (utilisateur_id, menu_jour_id, creneau_id, jour, prix_paye, est_offre, jeton_qr, code_court)
select '00000000-0000-0000-0000-0000000000a1', (select val::bigint from ctx where cle = 'menu_jour'),
       (select val::smallint from ctx where cle = 'creneau'), public.aujourdhui(), 0, true,
       'jetonpasse0000000000000000000000000000000000000000000000000000000', 'VTL-9043';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
do $$
declare v json; r bigint; m text;
begin
  v := public.servir('VTL-9043', false);
  r := (v -> 'ticket' ->> 'reservation_id')::bigint;
  insert into resultats (critere, test, resultat) values ('Métier', 'Configuration 2 : ticket validé à l''entrée et envoyé au passe',
    case when (v ->> 'ok')::boolean and (v ->> 'envoye_au_passe')::boolean
              and (select remis_le is null and scanne_le is not null from public.reservations where id = r) then 'OK' else 'ÉCHEC : ' || v::text end);
  perform public.remettre(r);
  begin perform public.remettre(r); m := 'ÉCHEC';
  exception when others then m := case when sqlerrm like '%déjà été remis%' then 'OK' else 'ÉCHEC : ' || sqlerrm end; end;
  insert into resultats (critere, test, resultat) values ('Métier', 'Le passe confirme la remise, une seule fois',
    case when m = 'OK' and (select remis_le is not null from public.reservations where id = r) then 'OK' else m end);
end $$;
reset role;

insert into resultats (critere, test, resultat)
select 'Traçabilité', 'Les refus au comptoir sont journalisés',
       case when count(*) = 2 then 'OK' else 'ÉCHEC : ' || count(*) end
from public.journal_audit where action = 'REFUS' and operation = 'servir'
  and horodatage = now();  -- seulement les refus de ce test (même transaction)

insert into resultats (critere, test, resultat)
select 'Intégrité', 'Solde égal à la somme des transactions',
       case when p.solde = coalesce(sum(case t.type when 'debit' then -t.montant else t.montant end), 0)
            then 'OK (' || p.solde || ' F)' else 'ÉCHEC' end
from public.profils p left join public.transactions t on t.utilisateur_id = p.id
where p.id = '00000000-0000-0000-0000-0000000000a1' group by p.solde;

-- Créneau du soir (encore à venir) : l'offre n'est lançable que s'il reste un créneau.
with c as (insert into public.creneaux (heure_debut, capacite) values ('23:52', 5) returning id)
insert into ctx select 'creneau_soir', id::text from c;

-- ===== Offre de fin de service : créneau déjà passé refusé (correctif du 21/11) =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select public.lancer_offre((select val::bigint from ctx where cle = 'menu_jour'), 500, now() + interval '30 minutes');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$
declare m text;
begin
  begin
    perform public.reserver((select val::bigint from ctx where cle = 'menu_jour'), (select val::smallint from ctx where cle = 'creneau'));
    m := 'ÉCHEC : réservation acceptée';
  exception when others then m := case when sqlerrm like '%déjà passé%' then 'OK' else 'ÉCHEC : ' || sqlerrm end;
  end;
  insert into resultats (critere, test, resultat) values ('Métier', 'Offre de fin de service : créneau déjà passé refusé', m);
end $$;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$
declare v1 json; v2 json; m text;
begin
  -- Awa a déjà son repas du jour : elle peut quand même acheter l'offre anti-gaspillage, et plusieurs fois.
  begin
    v1 := public.reserver((select val::bigint from ctx where cle = 'menu_jour'), (select val::smallint from ctx where cle = 'creneau_soir'));
    v2 := public.reserver((select val::bigint from ctx where cle = 'menu_jour'), (select val::smallint from ctx where cle = 'creneau_soir'));
    m := case when (v1 ->> 'prix_paye')::int = 500 and (v2 ->> 'prix_paye')::int = 500 then 'OK' else 'ÉCHEC : ' || v1::text end;
  exception when others then m := 'ÉCHEC : ' || sqlerrm;
  end;
  insert into resultats (critere, test, resultat) values ('Métier', 'Offre anti-gaspillage achetable deux fois, même avec un repas déjà réservé', m);
end $$;
reset role;

-- ===== Awa note son repas =====
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
do $$
declare m text; r bigint;
begin
  select id into r from public.reservations where code_court = 'VTL-9042' and jour = public.aujourdhui();
  perform public.noter(r, 5::smallint, 'Très bon');
  begin perform public.noter(r, 1::smallint); m := 'ÉCHEC';
  exception when others then m := case when sqlerrm like '%déjà été noté%' then 'OK' else 'ÉCHEC : ' || sqlerrm end; end;
  insert into resultats (critere, test, resultat) values ('Intégrité', 'Une seule note par repas servi', m);
end $$;
reset role;

select critere, test, resultat from resultats order by n;
rollback;
