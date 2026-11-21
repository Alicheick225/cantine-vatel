-- =============================================================================
-- Rapport d'activité (besoin du guide : « générer des rapports d'activité »).
-- Tout le rapport d'une période en un appel, réservé à l'admin.
-- =============================================================================
create function public.rapport_activite(p_debut date, p_fin date)
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
  if p_fin < p_debut then perform prive.refuser('La date de fin précède la date de début.'); end if;

  with res as (
    select r.*, pr.categorie
    from public.reservations r join public.profils pr on pr.id = r.utilisateur_id
    where r.jour between p_debut and p_fin and r.statut <> 'annulee'
  ),
  menus as (
    select m.*, p.nom, p.type from public.menus_jour m join public.plats p on p.id = m.plat_id
    where m.jour between p_debut and p_fin and p.type <> 'boisson'
  ),
  par_jour as (
    select m.jour,
           (select count(*) from res where res.jour = m.jour)::int as reservees,
           (select count(*) from res where res.jour = m.jour and res.statut = 'servie')::int as servies,
           (select count(*) from res where res.jour = m.jour and res.statut = 'reservee' and res.jour < public.aujourdhui())::int as absences,
           (select coalesce(sum(prix_paye), 0) from res where res.jour = m.jour)::int as recettes,
           coalesce(sum(m.portions_preparees), 0)::int as preparees,
           (select count(*) from res where res.jour = m.jour and res.est_offre and res.statut = 'servie')::int as sauvees
    from menus m group by m.jour
  ),
  par_plat as (
    select m.nom,
           count(distinct m.id)::int as jours_au_menu,
           count(res.id)::int as reservees,
           count(res.id) filter (where res.statut = 'servie')::int as servies,
           coalesce(sum(res.prix_paye), 0)::int as recettes,
           (select round(avg(n.valeur), 1) from public.notes n join res r2 on r2.id = n.reservation_id
              join public.menus_jour m2 on m2.id = r2.menu_jour_id
             where m2.plat_id = (select plat_id from public.menus_jour where id = min(m.id))) as note_moyenne
    from menus m left join res on res.menu_jour_id = m.id
    group by m.nom
  ),
  recharges as (
    select coalesce(sum(t.montant), 0)::int as total, count(*)::int as nombre
    from public.transactions t
    where t.type = 'recharge' and (t.cree_le at time zone 'Africa/Abidjan')::date between p_debut and p_fin
  )
  select json_build_object(
    'debut', p_debut, 'fin', p_fin,
    'totaux', json_build_object(
      'reservees', (select count(*) from res),
      'servies', (select count(*) from res where statut = 'servie'),
      'absences', (select count(*) from res where statut = 'reservee' and jour < public.aujourdhui()),
      'recettes', (select coalesce(sum(prix_paye), 0) from res),
      'recharges', (select total from recharges),
      'nb_recharges', (select nombre from recharges),
      'preparees', (select coalesce(sum(preparees), 0) from par_jour where jour < public.aujourdhui()),
      'servies_passees', (select coalesce(sum(servies), 0) from par_jour where jour < public.aujourdhui()),
      'sauvees', (select coalesce(sum(sauvees), 0) from par_jour),
      'convives_distincts', (select count(distinct utilisateur_id) from res),
      'etudiants', (select count(*) from res where categorie = 'etudiant'),
      'personnel', (select count(*) from res where categorie = 'personnel')
    ),
    'par_jour', coalesce((select json_agg(par_jour order by jour) from par_jour), '[]'::json),
    'par_plat', coalesce((select json_agg(par_plat order by servies desc) from par_plat), '[]'::json)
  ) into v;
  return v;
end;
$$;
revoke execute on function public.rapport_activite(date, date) from public, anon;
grant execute on function public.rapport_activite(date, date) to authenticated;
