-- =============================================================================
-- Durcissement de la sécurité, suite à l'analyse « supabase db advisors »
-- =============================================================================

-- 1. Chemin de recherche figé sur toutes nos fonctions (évite le détournement de fonctions).
alter function public.allergenes_valides(text[]) set search_path = public;
alter function public.aujourdhui() set search_path = public;
alter function public.fn_horodatage() set search_path = public;
alter function public.fn_interdire_modification() set search_path = public;
alter function public.entete_requete(text) set search_path = public;

-- 2. Fonctions d'aide aux règles d'accès : déplacées dans un schéma privé, non exposé par l'API.
create schema if not exists prive;
revoke all on schema prive from public;
grant usage on schema prive to authenticated;
alter function public.est_admin() set schema prive;
alter function public.est_parent_de(uuid) set schema prive;
revoke execute on function prive.est_admin() from public, anon;
revoke execute on function prive.est_parent_de(uuid) from public, anon;
grant execute on function prive.est_admin() to authenticated;
grant execute on function prive.est_parent_de(uuid) to authenticated;

-- 3. Fonctions de déclencheur : jamais appelables depuis l'API.
revoke execute on function public.fn_creer_profil() from public, anon, authenticated;
revoke execute on function public.fn_journal_audit() from public, anon, authenticated;
revoke execute on function public.fn_horodatage() from public, anon, authenticated;
revoke execute on function public.fn_interdire_modification() from public, anon, authenticated;
revoke execute on function public.entete_requete(text) from public, anon, authenticated;
do $$ begin
  revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
exception when undefined_function then null;
end $$;

-- 4. Par défaut, les futures fonctions ne sont exécutables par personne :
--    chaque fonction métier sera ouverte explicitement aux connectés.
alter default privileges in schema public revoke execute on functions from public;
alter default privileges in schema public revoke execute on functions from anon;

-- 5. Règles d'accès réécrites : auth.uid() évalué une seule fois par requête,
--    et une seule règle par action (lecture / ajout / modification / suppression).
drop policy profils_lecture on public.profils;
drop policy profils_modification on public.profils;
create policy profils_lecture on public.profils for select to authenticated
  using (id = (select auth.uid()) or (select prive.est_admin()) or prive.est_parent_de(id));
create policy profils_modification on public.profils for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

drop policy plats_lecture on public.plats;
drop policy plats_gestion on public.plats;
create policy plats_lecture on public.plats for select to authenticated using (true);
create policy plats_ajout on public.plats for insert to authenticated with check ((select prive.est_admin()));
create policy plats_modification on public.plats for update to authenticated
  using ((select prive.est_admin())) with check ((select prive.est_admin()));
create policy plats_suppression on public.plats for delete to authenticated using ((select prive.est_admin()));

drop policy creneaux_lecture on public.creneaux;
drop policy creneaux_gestion on public.creneaux;
create policy creneaux_lecture on public.creneaux for select to authenticated using (true);
create policy creneaux_ajout on public.creneaux for insert to authenticated with check ((select prive.est_admin()));
create policy creneaux_modification on public.creneaux for update to authenticated
  using ((select prive.est_admin())) with check ((select prive.est_admin()));
create policy creneaux_suppression on public.creneaux for delete to authenticated using ((select prive.est_admin()));

drop policy menus_lecture on public.menus_jour;
drop policy menus_gestion on public.menus_jour;
create policy menus_lecture on public.menus_jour for select to authenticated using (true);
create policy menus_ajout on public.menus_jour for insert to authenticated with check ((select prive.est_admin()));
create policy menus_modification on public.menus_jour for update to authenticated
  using ((select prive.est_admin())) with check ((select prive.est_admin()));
create policy menus_suppression on public.menus_jour for delete to authenticated using ((select prive.est_admin()));

drop policy reservations_lecture on public.reservations;
create policy reservations_lecture on public.reservations for select to authenticated
  using (utilisateur_id = (select auth.uid()) or (select prive.est_admin()) or prive.est_parent_de(utilisateur_id));

drop policy transactions_lecture on public.transactions;
create policy transactions_lecture on public.transactions for select to authenticated
  using (utilisateur_id = (select auth.uid()) or (select prive.est_admin()) or prive.est_parent_de(utilisateur_id));

drop policy notes_lecture on public.notes;
create policy notes_lecture on public.notes for select to authenticated
  using ((select prive.est_admin()) or exists (
    select 1 from public.reservations r where r.id = reservation_id and r.utilisateur_id = (select auth.uid())));

drop policy liens_lecture on public.liens_parent;
create policy liens_lecture on public.liens_parent for select to authenticated
  using (parent_id = (select auth.uid()) or enfant_id = (select auth.uid()) or (select prive.est_admin()));

drop policy journal_lecture on public.journal_audit;
create policy journal_lecture on public.journal_audit for select to authenticated
  using ((select prive.est_admin()));
