-- Le stockage a besoin d'un droit de lecture pour retrouver un fichier avant de le remplacer ou de le supprimer.
-- Les photos des plats sont publiques de toute façon (elles s'affichent dans le menu).
create policy photos_plats_lecture on storage.objects for select to authenticated
  using (bucket_id = 'plats');
