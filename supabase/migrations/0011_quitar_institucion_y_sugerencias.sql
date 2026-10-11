-- ============================================================
-- 0011 · Fuera «Institución Educativa» y «Sugerencias» (Frame 1.5.9 /
-- Android 1.0.11, 7-oct-2026).
--
-- Las dos funciones se quitaron de la app por completo: los errores y las
-- propuestas llegan por correo a vt.asvent@gmail.com. Aquí se borra lo que
-- quedaba en el servidor: tablas school_* y feedback, sus funciones
-- (públicas y privadas) y las reglas de acceso al bucket «school».
--
-- Respaldo previo (solo datos de prueba):
--   supabase/respaldos/colegio-y-sugerencias-2026-10-07.json
--
-- NO se toca: telemetry_users.classroom, impact_overview ni
-- telemetry_report. Las versiones anteriores de Frame aún envían el salón al
-- informar el uso, y quitar la columna rompería su telemetría.
--
-- El bucket «school» queda vacío de reglas: privado y sin políticas, nadie
-- puede leerlo ni escribir en él. Su único archivo (84 KB, de prueba) se
-- borra desde el panel de Storage, porque Supabase no deja hacerlo por SQL.
-- ============================================================

drop policy if exists school_files_read   on storage.objects;
drop policy if exists school_files_insert on storage.objects;
drop policy if exists school_files_delete on storage.objects;

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where (n.nspname = 'public'  and (p.proname like 'school\_%' or p.proname like 'feedback\_%'))
       or (n.nspname = 'private' and p.proname like 'school\_%')
  loop
    execute format('drop function if exists %s cascade', f.sig);
  end loop;
end
$$;

drop table if exists
  public.school_code_attempts,
  public.school_codes,
  public.school_members,
  public.school_posts,
  public.school_snapshots,
  public.school_staff,
  public.school_student_passes,
  public.school_task_status,
  public.school_teaching,
  public.feedback
  cascade;
