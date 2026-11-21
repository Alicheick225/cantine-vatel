-- =============================================================================
-- Photos des plats envoyées par l'admin (Supabase Storage).
-- Lecture publique (les photos s'affichent dans le menu) ; écriture réservée à l'admin.
-- =============================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('plats', 'plats', true, 2097152, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy photos_plats_ajout on storage.objects for insert to authenticated
  with check (bucket_id = 'plats' and (select prive.est_admin()));
create policy photos_plats_modification on storage.objects for update to authenticated
  using (bucket_id = 'plats' and (select prive.est_admin()))
  with check (bucket_id = 'plats' and (select prive.est_admin()));
create policy photos_plats_suppression on storage.objects for delete to authenticated
  using (bucket_id = 'plats' and (select prive.est_admin()));
