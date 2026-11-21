-- =============================================================================
-- Prévision des repas (bonus « Prévoir ») : statistique simple et explicable.
--   attendus = réservations déjà faites
--            + estimation des réservations à venir (si la réservation est encore ouverte)
--   estimation du jour = moyenne des réservations du même jour de semaine (4 dernières semaines)
--   répartition par plat = popularité des 6 dernières semaines, ajustée par la note moyenne
--   à préparer = attendus × taux de présence observé × 1,05 (marge), arrondi au supérieur
-- =============================================================================
create function public.prevision(p_debut date, p_fin date)
returns table (
  jour date, menu_jour_id bigint, plat text, photo_url text,
  reservees integer, estimees integer, attendus integer, a_preparer integer,
  portions_prevues integer, taux_presence numeric, moyenne_jour numeric
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_taux numeric;
begin
  if prive.mon_role() is distinct from 'admin' then
    perform prive.refuser('Réservé aux administrateurs.');
  end if;

  -- Taux de présence des 4 dernières semaines (servis / réservés non annulés).
  select coalesce(count(*) filter (where r.statut = 'servie')::numeric / nullif(count(*), 0), 0.9)
    into v_taux
    from public.reservations r
   where r.statut <> 'annulee' and r.jour between public.aujourdhui() - 28 and public.aujourdhui() - 1;

  return query
  with jours as (
    select d::date as j from generate_series(p_debut, p_fin, interval '1 day') d where extract(isodow from d) <= 5
  ),
  moyennes as (
    -- Réservations moyennes du même jour de semaine, 4 dernières semaines.
    select jo.j, coalesce(avg(h.nb), 0) as moy
    from jours jo
    left join lateral (
      select count(*) as nb from public.reservations r
      where r.statut <> 'annulee' and r.jour < public.aujourdhui()
        and r.jour in (jo.j - 7, jo.j - 14, jo.j - 21, jo.j - 28)
        and r.jour >= public.aujourdhui() - 35
      group by r.jour
    ) h on true
    group by jo.j
  ),
  popularite as (
    -- Part de chaque plat quand il est au menu, ajustée par sa note.
    select m.plat_id,
           count(r.id)::numeric / nullif(count(distinct m.id), 0) as par_jour,
           coalesce(avg(n.valeur), 3.5) as note
    from public.menus_jour m
    left join public.reservations r on r.menu_jour_id = m.id and r.statut <> 'annulee'
    left join public.notes n on n.reservation_id = r.id
    where m.jour between public.aujourdhui() - 42 and public.aujourdhui() - 1
    group by m.plat_id
  ),
  lignes as (
    select m.jour, m.id as menu_jour_id, p.nom, p.photo_url, m.portions_prevues,
           (select count(*) from public.reservations r where r.menu_jour_id = m.id and r.statut <> 'annulee')::int as res,
           coalesce(po.par_jour, 5) * (1 + (coalesce(po.note, 3.5) - 3.5) * 0.10) as poids,
           mo.moy,
           (now() < public.heure_limite(m.jour)) as ouvert
    from public.menus_jour m
    join public.plats p on p.id = m.plat_id and p.type <> 'boisson' and p.actif
    join moyennes mo on mo.j = m.jour
    left join popularite po on po.plat_id = m.plat_id
  ),
  calcul as (
    select l.*,
           sum(l.res) over (partition by l.jour) as res_jour,
           l.poids / nullif(sum(l.poids) over (partition by l.jour), 0) as part
    from lignes l
  )
  select c.jour, c.menu_jour_id, c.nom, c.photo_url, c.res,
         case when c.ouvert then round(greatest(c.moy - c.res_jour, 0) * c.part)::int else 0 end,
         c.res + case when c.ouvert then round(greatest(c.moy - c.res_jour, 0) * c.part)::int else 0 end,
         ceil((c.res + case when c.ouvert then round(greatest(c.moy - c.res_jour, 0) * c.part) else 0 end) * v_taux * 1.05)::int,
         c.portions_prevues, round(v_taux * 100), round(c.moy)
  from calcul c
  order by c.jour, c.nom;
end;
$$;

-- Appliquer la prévision : les portions prévues d'un jour prennent la valeur conseillée.
create function public.appliquer_prevision(p_jour date)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_n integer;
begin
  perform set_config('app.operation', 'appliquer_prevision', true);
  if prive.mon_role() is distinct from 'admin' then
    perform prive.refuser('Réservé aux administrateurs.');
  end if;
  if p_jour < public.aujourdhui() then perform prive.refuser('Ce jour est passé.'); end if;
  update public.menus_jour m set portions_prevues = greatest(pv.a_preparer, pv.reservees)
    from public.prevision(p_jour, p_jour) pv
   where pv.menu_jour_id = m.id;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Gaspillage par semaine : portions préparées − portions servies, et portions sauvées par les offres.
create function public.gaspillage_semaines(p_semaines integer default 6)
returns table (semaine date, preparees integer, servies integer, jetees integer, sauvees integer)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if prive.mon_role() is distinct from 'admin' then
    perform prive.refuser('Réservé aux administrateurs.');
  end if;
  return query
  select date_trunc('week', m.jour)::date,
         sum(m.portions_preparees)::int,
         sum(s.nb)::int,
         greatest(sum(m.portions_preparees) - sum(s.nb), 0)::int,
         sum(s.offres)::int
  from public.menus_jour m
  join public.plats p on p.id = m.plat_id and p.type <> 'boisson'
  left join lateral (select count(*) filter (where r.statut = 'servie') nb,
                            count(*) filter (where r.statut = 'servie' and r.est_offre) offres
                     from public.reservations r where r.menu_jour_id = m.id) s on true
  where m.jour < public.aujourdhui() and m.jour >= public.aujourdhui() - p_semaines * 7
    and m.portions_preparees is not null
  group by 1 order by 1;
end;
$$;

revoke execute on function public.prevision(date, date), public.appliquer_prevision(date), public.gaspillage_semaines(integer) from public, anon;
grant execute on function public.prevision(date, date), public.appliquer_prevision(date), public.gaspillage_semaines(integer) to authenticated;
