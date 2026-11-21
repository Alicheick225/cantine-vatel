-- =============================================================================
-- Données de référence et menus de démonstration (rejouable sans doublon).
-- Lancement : supabase db query --remote --yes -f supabase/seed.sql
-- Photos : Wikimedia Commons, licences libres, copies allégées servies par l'application (public/plats, crédits dans le README).
-- =============================================================================
select set_config('app.operation', 'donnees_demo', false);

-- Créneaux de retrait : 11h30 à 13h45, toutes les 15 minutes.
insert into public.creneaux (heure_debut, capacite)
select h::time, 25
from generate_series(timestamp '2000-01-01 11:30', timestamp '2000-01-01 13:45', interval '15 minutes') h
on conflict (heure_debut) do nothing;

-- Plats (prix unique, déjà subventionné).
insert into public.plats (nom, description, prix, type, allergenes, vegetarien, photo_url)
select v.* from (values
  ('Garba', 'Attiéké, thon frit, piment et oignons', 1000, 'plat'::public.type_plat, '{poisson}'::text[], false,
   '/plats/garba.jpg'),
  ('Kédjénou de poulet', 'Poulet mijoté à l''étouffée, riz blanc', 2500, 'plat', '{}', false,
   '/plats/kedjenou.jpg'),
  ('Alloco poulet braisé', 'Bananes plantains frites, poulet braisé, sauce tomate', 2000, 'plat', '{}', false,
   '/plats/alloco.jpg'),
  ('Riz sauce graine', 'Sauce graine de palme, viande de bœuf', 1500, 'plat', '{}', false,
   '/plats/sauce-graine.jpg'),
  ('Attiéké poisson braisé', 'Attiéké, poisson braisé, crudités', 2000, 'plat', '{poisson}', false,
   '/plats/attieke-poisson.jpg'),
  ('Placali sauce kopè', 'Placali, sauce gombo kopè au poisson fumé', 1500, 'plat', '{poisson}', false,
   '/plats/placali.jpg'),
  ('Alloco œuf', 'Bananes plantains frites, œufs, sauce tomate pimentée', 1000, 'plat', '{oeuf}', true, '/plats/alloco-oeuf.jpg'),
  ('Bissap', 'Jus de fleurs d''hibiscus, menthe', 300, 'boisson', '{}', true, '/plats/bissap.jpg')
) as v(nom, description, prix, type, allergenes, vegetarien, photo_url)
where not exists (select 1 from public.plats p where p.nom = v.nom);

-- Menus : jours ouvrés, de 6 semaines en arrière (historique pour la prévision) à 2 semaines en avant.
-- Chaque jour : le garba, 3 plats qui tournent, l'alloco œuf (végétarien) et le bissap.
with jours as (
  select d::date as jour, row_number() over (order by d) as n
  from generate_series(public.aujourdhui() - 42, public.aujourdhui() + 14, interval '1 day') d
  where extract(isodow from d) <= 5
),
tournants as (
  select nom, row_number() over (order by nom) - 1 as rang
  from public.plats where nom in ('Kédjénou de poulet','Alloco poulet braisé','Riz sauce graine','Attiéké poisson braisé','Placali sauce kopè')
),
choix as (
  select j.jour, p.id as plat_id,
         case p.nom when 'Garba' then 60 when 'Bissap' then 80 when 'Alloco œuf' then 25 else 45 end as portions
  from jours j
  join public.plats p on p.nom in ('Garba','Alloco œuf','Bissap')
  union all
  select j.jour, p.id, 45
  from jours j
  join tournants t on ((t.rang + j.n) % 5) < 3
  join public.plats p on p.nom = t.nom
)
insert into public.menus_jour (jour, plat_id, portions_prevues, portions_preparees)
select jour, plat_id, portions, case when jour < public.aujourdhui() then portions end
from choix
on conflict (jour, plat_id) do nothing;
