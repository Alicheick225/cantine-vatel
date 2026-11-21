-- =============================================================================
-- Système de notation (bonus du guide) : les avis d'un plat, visibles par tous les connectés.
-- Note moyenne, nombre d'avis, répartition des étoiles et derniers commentaires.
-- Confidentialité : seul le prénom de l'auteur est montré (ni nom complet, ni email).
-- =============================================================================
create function public.avis_plat(p_plat bigint)
returns json
language sql
stable
security definer
set search_path = public
as $$
  with n as (
    select n.valeur, n.commentaire, n.cree_le, split_part(pr.nom, ' ', 1) as prenom
    from public.notes n
    join public.reservations r on r.id = n.reservation_id
    join public.menus_jour m on m.id = r.menu_jour_id
    join public.profils pr on pr.id = r.utilisateur_id
    where m.plat_id = p_plat
  )
  select json_build_object(
    'moyenne', (select round(avg(valeur), 1) from n),
    'nombre', (select count(*) from n),
    'repartition', (select json_object_agg(v, (select count(*) from n where valeur = v)) from generate_series(1, 5) v),
    'commentaires', coalesce((select json_agg(c) from (
        select valeur, commentaire, cree_le, prenom from n
        where commentaire is not null order by cree_le desc limit 5) c), '[]'::json)
  )
  where auth.uid() is not null;
$$;
revoke execute on function public.avis_plat(bigint) from public, anon;
grant execute on function public.avis_plat(bigint) to authenticated;
