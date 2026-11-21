-- =============================================================================
-- Tableau de bord admin et temps réel
-- =============================================================================

-- Tout le tableau de bord d'un jour en un seul appel (admin uniquement).
create function public.tableau_bord(p_jour date)
returns json
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v json;
begin
  if prive.mon_role() is distinct from 'admin' then
    perform prive.refuser('Réservé aux administrateurs.');
  end if;

  with res as (
    select r.* from public.reservations r where r.jour = p_jour and r.statut <> 'annulee'
  ),
  plats as (
    select m.id as menu_jour_id, p.nom, p.type, p.photo_url, p.prix, m.portions_prevues, m.portions_preparees,
           m.prix_offre, m.fin_offre,
           (m.prix_offre is not null and now() < m.fin_offre and m.jour = public.aujourdhui()) as offre_active,
           count(res.id) filter (where true)::int as reservees,
           count(res.id) filter (where res.statut = 'servie')::int as servies,
           count(res.id) filter (where res.est_offre)::int as vendues_en_offre
    from public.menus_jour m
    join public.plats p on p.id = m.plat_id
    left join res on res.menu_jour_id = m.id
    where m.jour = p_jour
    group by m.id, p.nom, p.type, p.photo_url, p.prix
  ),
  creneaux as (
    select c.heure_debut, count(res.id)::int as reservees, count(res.id) filter (where res.statut = 'servie')::int as servies
    from public.creneaux c left join res on res.creneau_id = c.id
    where c.actif
    group by c.heure_debut
  ),
  presence as (
    select count(*) filter (where statut = 'servie')::numeric / nullif(count(*), 0) as taux
    from public.reservations
    where statut <> 'annulee' and jour between p_jour - 7 and p_jour - 1
  )
  select json_build_object(
    'jour', p_jour,
    'reservees', (select count(*) from res),
    'servies', (select count(*) from res where statut = 'servie'),
    'recettes', (select coalesce(sum(prix_paye), 0) from res),
    'portions_sauvees', (select coalesce(sum(vendues_en_offre), 0) from plats),
    'taux_presence_7j', (select round(taux * 100) from presence),
    'plats', coalesce((select json_agg(plats order by type, nom) from plats), '[]'::json),
    'creneaux', coalesce((select json_agg(creneaux order by heure_debut) from creneaux), '[]'::json)
  ) into v;
  return v;
end;
$$;
revoke execute on function public.tableau_bord(date) from public, anon;
grant execute on function public.tableau_bord(date) to authenticated;

-- Temps réel : les écrans admin et convive sont prévenus des changements
-- (la RLS s'applique : chacun ne reçoit que ce qu'il a le droit de voir).
alter publication supabase_realtime add table public.reservations;
alter publication supabase_realtime add table public.menus_jour;
