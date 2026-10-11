-- ============================================================
-- 0007 · Imágenes que viajan entre dispositivos (Frame 1.5.5 / Android 1.0.8)
--
-- Foto de perfil, horario, portadas de playlist, de asignatura y de colección.
-- Antes solo viajaban los datos (tabla `backups`): cambiar la foto en la
-- laptop no llegaba nunca a la tablet.
--
-- Cada cuenta tiene su carpeta `<uid>/` en un bucket PRIVADO y solo puede
-- tocar la suya. El índice de qué imagen está en qué versión viaja dentro del
-- respaldo normal (clave `syncedImages`); aquí solo se guardan los archivos.
-- La música, las portadas de canciones y los adjuntos NO se suben: pesan
-- demasiado para el plan gratuito.
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'user-images',
  'user-images',
  false,
  5242880, -- 5 MB por imagen; la app reduce las más grandes antes de subirlas
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

create policy "user_images_read"
  on storage.objects for select to authenticated
  using (bucket_id = 'user-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "user_images_insert"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'user-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "user_images_update"
  on storage.objects for update to authenticated
  using (bucket_id = 'user-images' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'user-images' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "user_images_delete"
  on storage.objects for delete to authenticated
  using (bucket_id = 'user-images' and (storage.foldername(name))[1] = (select auth.uid())::text);
