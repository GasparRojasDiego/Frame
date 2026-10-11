-- ===========================================================================
-- Frame 1.4.9 — Código de la institución para los estudiantes
--
-- Hasta ahora cualquier cuenta podía unirse a un salón del COAR Junín con
-- solo elegirlo en un recuadro que salía al abrir la app. Desde esta versión
-- el estudiante vincula su cuenta en Ajustes con el CÓDIGO DE LA INSTITUCIÓN,
-- que genera el responsable de Frame igual que los del personal (bcrypt en
-- `school_codes`, con límite de intentos), y solo después elige grado y
-- sección.
--
-- El código no se comprueba solo en la app: validarlo concede un «pase» en
-- `school_student_passes`, y la base de datos exige ese pase para CREAR una
-- membresía. Quien ya estaba en un salón no pierde nada (su fila existe y
-- actualizarla no pide pase).
-- ===========================================================================

-- 1. Un cuarto código: el de los estudiantes.
alter table public.school_codes drop constraint if exists school_codes_role_check;
alter table public.school_codes
  add constraint school_codes_role_check check (role in ('teacher', 'tutor', 'auxiliary', 'student'));

create or replace function public.school_set_code(p_role text, p_code text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_frame_owner() then
    raise exception 'Solo el responsable de Frame puede cambiar los códigos' using errcode = '42501';
  end if;
  if p_role not in ('teacher', 'tutor', 'auxiliary', 'student') then
    raise exception 'Función desconocida';
  end if;
  if char_length(coalesce(p_code, '')) < 8 then
    raise exception 'El código debe tener al menos 8 caracteres';
  end if;
  insert into public.school_codes (role, code_hash, updated_at)
  values (p_role, crypt(p_code, gen_salt('bf', 8)), now())
  on conflict (role) do update set code_hash = excluded.code_hash, updated_at = now();
end;
$$;

-- 2. El pase: constancia de que esta cuenta presentó el código correcto.
create table if not exists public.school_student_passes (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table public.school_student_passes enable row level security;
revoke all on public.school_student_passes from anon, authenticated;

-- 3. Validar el código. Mismo límite que el personal: 8 fallos cada 15 min.
create or replace function public.school_verify_student_code(p_code text)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  uid    uuid := auth.uid();
  stored text;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'Inicia sesión para continuar.');
  end if;

  delete from public.school_code_attempts where at < now() - interval '1 day';
  if (select count(*) from public.school_code_attempts a
       where a.user_id = uid and a.at > now() - interval '15 minutes') >= 8 then
    return jsonb_build_object('ok', false, 'error', 'Demasiados intentos. Espera unos minutos y vuelve a probar.');
  end if;

  select code_hash into stored from public.school_codes where role = 'student';
  if stored is null then
    return jsonb_build_object('ok', false, 'error', 'Tu institución todavía no ha habilitado el acceso de estudiantes.');
  end if;
  if stored <> crypt(coalesce(btrim(p_code), ''), stored) then
    insert into public.school_code_attempts (user_id) values (uid);
    return jsonb_build_object('ok', false, 'error', 'El código no es correcto.');
  end if;

  insert into public.school_student_passes (user_id) values (uid)
  on conflict (user_id) do update set granted_at = now();
  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.school_verify_student_code(text) from public, anon;
grant execute on function public.school_verify_student_code(text) to authenticated;

-- 4. Crear una membresía exige el pase.
drop policy if exists school_members_insert on public.school_members;
create policy school_members_insert on public.school_members for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.school_student_passes p where p.user_id = (select auth.uid()))
  );

-- 5. Quien ya estaba en un salón conserva todo: se le concede el pase.
--    (Cambiar de salón pasa por la misma inserción con reemplazo que unirse,
--    y sin pase la base de datos se la negaría.)
insert into public.school_student_passes (user_id)
select user_id from public.school_members
on conflict (user_id) do nothing;
