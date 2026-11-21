-- =============================================================================
-- Une offre de fin de service n'a de sens que s'il reste un créneau pour la retirer.
--   - menu_periode : offre_active est faux quand tous les créneaux du jour sont passés ;
--   - lancer_offre : refuse de lancer une offre s'il ne reste aucun créneau.
-- =============================================================================
create function prive.creneau_restant(p_jour date)
returns boolean
language sql stable
set search_path = public
as $$
  select exists (select 1 from public.creneaux c
                 where c.actif and now() < public.fin_creneau(p_jour, c.heure_debut))
$$;
revoke execute on function prive.creneau_restant(date) from public, anon;
grant execute on function prive.creneau_restant(date) to authenticated;

create or replace function public.menu_periode(p_debut date, p_fin date)
returns table (
  menu_jour_id bigint, jour date, plat_id bigint, nom text, description text, prix integer,
  type public.type_plat, allergenes text[], vegetarien boolean, photo_url text,
  portions_prevues integer, reservees integer, restantes integer,
  note_moyenne numeric, nb_notes integer,
  prix_offre integer, fin_offre timestamptz, offre_active boolean, reservable boolean
)
language sql stable
security definer
set search_path = public
as $$
  select m.id, m.jour, p.id, p.nom, p.description, p.prix, p.type, p.allergenes, p.vegetarien, p.photo_url,
         m.portions_prevues,
         coalesce(r.nb, 0)::int,
         greatest(coalesce(m.portions_preparees, m.portions_prevues) - coalesce(r.nb, 0), 0)::int,
         n.moyenne, coalesce(n.nb, 0)::int,
         m.prix_offre, m.fin_offre,
         (m.prix_offre is not null and now() < m.fin_offre and m.jour = public.aujourdhui()
          and prive.creneau_restant(m.jour)),
         (now() < public.heure_limite(m.jour))
  from public.menus_jour m
  join public.plats p on p.id = m.plat_id
  left join lateral (select count(*) nb from public.reservations x
                     where x.menu_jour_id = m.id and x.statut <> 'annulee') r on true
  left join lateral (select round(avg(no.valeur), 1) moyenne, count(*) nb
                     from public.notes no join public.reservations rr on rr.id = no.reservation_id
                     join public.menus_jour mm on mm.id = rr.menu_jour_id
                     where mm.plat_id = p.id) n on true
  where m.jour between p_debut and p_fin and p.actif
    and auth.uid() is not null
  order by m.jour, p.type, p.nom
$$;

create or replace function public.lancer_offre(p_menu_jour bigint, p_prix integer, p_fin timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_menu public.menus_jour;
  v_prix_plat integer;
begin
  perform set_config('app.operation', 'lancer_offre', true);
  if prive.mon_role() is distinct from 'admin' then
    perform prive.refuser('Seul un administrateur peut lancer une offre.');
  end if;
  select * into v_menu from public.menus_jour where id = p_menu_jour for update;
  if not found or v_menu.jour <> public.aujourdhui() then
    perform prive.refuser('Une offre ne concerne qu''un plat du jour.');
  end if;
  if not prive.creneau_restant(v_menu.jour) then
    perform prive.refuser('Le service est terminé : plus aucun créneau pour retirer une offre.');
  end if;
  select prix into v_prix_plat from public.plats where id = v_menu.plat_id;
  if p_prix <= 0 or p_prix >= v_prix_plat then
    perform prive.refuser('Le prix de l''offre doit être inférieur au prix normal.');
  end if;
  if p_fin <= now() then perform prive.refuser('L''heure de fin doit être dans le futur.'); end if;
  update public.menus_jour set prix_offre = p_prix, fin_offre = p_fin where id = p_menu_jour;
end;
$$;
revoke execute on function public.menu_periode(date, date), public.lancer_offre(bigint, integer, timestamptz) from public, anon;
grant execute on function public.menu_periode(date, date), public.lancer_offre(bigint, integer, timestamptz) to authenticated;
