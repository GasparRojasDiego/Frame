-- =============================================================================
-- Frame · Eliminación de cuenta desde el cliente
-- =============================================================================
-- La app es de escritorio: la clave `anon` viaja dentro del instalador y la
-- `service_role` JAMÁS puede empaquetarse, por lo que
-- `supabase.auth.admin.deleteUser()` queda descartada.
--
-- Esta función `SECURITY DEFINER` es la única vía para que el propio usuario
-- borre de verdad su fila de `auth.users` presentando solo su JWT.
--
-- CÓMO APLICARLA (una sola vez, manualmente):
--   Panel de Supabase → SQL Editor → pegar este archivo → Run.
--   Debe ejecutarse con el rol `postgres` (dueño), único con permiso para
--   borrar de `auth.users`.
--
-- MIENTRAS NO SE APLIQUE: el cliente detecta que el RPC no existe (PGRST202 /
-- 42883), degrada a purgar solo los datos y avisa al usuario con honestidad de
-- que su correo sigue registrado. Ver `deleteRemoteAccount` en
-- `src/lib/supabase/auth.ts`.
-- =============================================================================

create or replace function public.delete_current_user()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'No hay sesión activa';
  end if;

  delete from public.backups          where user_id = uid;
  delete from public.telemetry_weekly where user_id = uid;
  delete from public.telemetry_users  where user_id = uid;
  delete from public.profiles         where id      = uid;

  -- Debe ir al final: borrar la identidad invalida el JWT en curso.
  delete from auth.users              where id      = uid;
end;
$$;

revoke all     on function public.delete_current_user() from public, anon;
grant  execute on function public.delete_current_user() to authenticated;

-- =============================================================================
-- Plan B: políticas RLS de DELETE
-- =============================================================================
-- Solo hacen falta si se decide NO desplegar la función de arriba. Sin ellas,
-- la vía degradada del cliente ejecuta los DELETE sin error pero afectando
-- CERO filas (las tablas de telemetría están documentadas como de solo
-- escritura en `src/lib/telemetry.ts`), dando una falsa sensación de borrado.
--
--   create policy "own delete" on public.backups          for delete using (auth.uid() = user_id);
--   create policy "own delete" on public.telemetry_users  for delete using (auth.uid() = user_id);
--   create policy "own delete" on public.telemetry_weekly for delete using (auth.uid() = user_id);
--   create policy "own delete" on public.profiles         for delete using (auth.uid() = id);
--
-- Aun con estas políticas, la fila de `auth.users` sobrevive: el correo seguirá
-- ocupado y el usuario no podrá volver a registrarse con él. Por eso la función
-- `delete_current_user()` es la opción recomendada.
-- =============================================================================
