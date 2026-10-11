-- =============================================================================
-- Frame · Colegio (COAR Junín): salones, personal, publicaciones y seguimiento
-- =============================================================================
-- Quién hace qué:
--   · ESTUDIANTE (app): se une a su salón (3A…5D), recibe lo que publica el
--     personal y, SOLO SI ACEPTA, comparte con su tutor(a) una instantánea de
--     rendimiento sin contenido (ni notas, ni nombres de tareas ni de hábitos).
--   · PROFESOR (web): publica tareas, recursos y recordatorios en SUS clases
--     (asignatura + salón).
--   · TUTOR (web): uno por salón; ve la lista de su salón y las instantáneas de
--     quienes comparten. Puede publicar avisos y recordatorios a su salón.
--   · AUXILIAR (web): publica avisos (generales o por salón) y la foto del
--     horario de cada salón.
--   · RESPONSABLE de Frame: habilita los códigos de acceso y administra al
--     personal. No lee las instantáneas de los estudiantes.
--
-- Una cuenta solo obtiene una función del personal presentando el código de esa
-- función (guardado con bcrypt). Idempotente: se puede volver a ejecutar.
-- =============================================================================

create schema if not exists private;
grant usage on schema private to authenticated;

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- 1. Códigos de acceso del personal (nadie los lee por la API)
-- ---------------------------------------------------------------------------
create table if not exists public.school_codes (
  role       text primary key check (role in ('teacher', 'tutor', 'auxiliary')),
  code_hash  text        not null,
  updated_at timestamptz not null default now()
);
alter table public.school_codes enable row level security;
revoke all on public.school_codes from anon, authenticated;

create table if not exists public.school_code_attempts (
  id      bigint generated always as identity primary key,
  user_id uuid        not null,
  at      timestamptz not null default now()
);
create index if not exists school_code_attempts_user_idx on public.school_code_attempts (user_id, at desc);
alter table public.school_code_attempts enable row level security;
revoke all on public.school_code_attempts from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2. Personal
-- ---------------------------------------------------------------------------
create table if not exists public.school_staff (
  user_id         uuid primary key references auth.users (id) on delete cascade,
  full_name       text        not null check (char_length(btrim(full_name)) between 3 and 80),
  email           text        not null default '',
  is_teacher      boolean     not null default false,
  is_tutor        boolean     not null default false,
  is_auxiliary    boolean     not null default false,
  tutor_classroom text unique check (tutor_classroom is null or tutor_classroom ~ '^[345][ABCD]$'),
  active          boolean     not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint school_staff_tutor_needs_classroom check (is_tutor = (tutor_classroom is not null))
);
alter table public.school_staff enable row level security;
-- El correo del personal no se expone a los demás usuarios: privilegios por columna.
revoke all on public.school_staff from anon, authenticated;
grant select (user_id, full_name, is_teacher, is_tutor, is_auxiliary, tutor_classroom, active, created_at)
  on public.school_staff to authenticated;

create table if not exists public.school_teaching (
  user_id   uuid not null references public.school_staff (user_id) on delete cascade,
  subject   text not null check (char_length(subject) between 2 and 60),
  classroom text not null check (classroom ~ '^[345][ABCD]$'),
  primary key (user_id, subject, classroom)
);
create index if not exists school_teaching_classroom_idx on public.school_teaching (classroom);
alter table public.school_teaching enable row level security;

-- ---------------------------------------------------------------------------
-- 3. Estudiantes e instantáneas para tutoría
-- ---------------------------------------------------------------------------
create table if not exists public.school_members (
  user_id          uuid primary key references auth.users (id) on delete cascade,
  classroom        text        not null check (classroom ~ '^[345][ABCD]$'),
  full_name        text        not null check (char_length(btrim(full_name)) between 3 and 80),
  school_year      integer     not null check (school_year between 2024 and 2100),
  share_with_tutor boolean     not null default false,
  consent_at       timestamptz,
  avatar           text check (avatar is null or char_length(avatar) < 60000),
  muted_subjects   text[]      not null default '{}',
  joined_at        timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists school_members_classroom_idx on public.school_members (classroom);
alter table public.school_members enable row level security;

create table if not exists public.school_snapshots (
  user_id    uuid primary key references public.school_members (user_id) on delete cascade,
  summary    jsonb       not null default '{}'::jsonb check (pg_column_size(summary) < 8192),
  data       jsonb       not null check (pg_column_size(data) < 600000),
  updated_at timestamptz not null default now()
);
alter table public.school_snapshots enable row level security;

-- ---------------------------------------------------------------------------
-- 4. Funciones de apoyo de la RLS (esquema privado: no se exponen por la API)
-- ---------------------------------------------------------------------------
create or replace function private.school_is_staff()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.school_staff s where s.user_id = (select auth.uid()) and s.active)
$$;

create or replace function private.school_is_teacher()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.school_staff s where s.user_id = (select auth.uid()) and s.active and s.is_teacher)
$$;

create or replace function private.school_tutor_classroom()
returns text language sql stable security definer set search_path = '' as $$
  select s.tutor_classroom from public.school_staff s
   where s.user_id = (select auth.uid()) and s.active and s.is_tutor
$$;

create or replace function private.school_my_classroom()
returns text language sql stable security definer set search_path = '' as $$
  select m.classroom from public.school_members m where m.user_id = (select auth.uid())
$$;

create or replace function private.school_valid_classrooms(p text[])
returns boolean language sql immutable set search_path = '' as $$
  select coalesce(array_length(p, 1), 0) between 1 and 12
     and not exists (select 1 from unnest(p) c where c !~ '^([345][ABCD]|ALL)$')
$$;

-- ¿Puede la sesión actual publicar esto con esta función?
create or replace function private.school_can_post(p_kind text, p_role text, p_subject text, p_classrooms text[])
returns boolean language sql stable security definer set search_path = '' as $$
  select case
    when st.user_id is null or not st.active then false
    when p_role = 'teacher' then
      st.is_teacher
      and p_kind in ('task', 'resource', 'reminder')
      and p_subject is not null
      and not ('ALL' = any (p_classrooms))
      and not exists (
        select 1 from unnest(p_classrooms) c
         where not exists (
           select 1 from public.school_teaching t
            where t.user_id = st.user_id and t.subject = p_subject and t.classroom = c))
    when p_role = 'auxiliary' then
      st.is_auxiliary
      and p_kind in ('notice', 'schedule')
      and (p_kind <> 'schedule' or (array_length(p_classrooms, 1) = 1 and p_classrooms[1] <> 'ALL'))
    when p_role = 'tutor' then
      st.is_tutor
      and p_kind in ('notice', 'reminder')
      and p_classrooms = array[st.tutor_classroom]
    else false
  end
  from (select 1) one
  left join public.school_staff st on st.user_id = (select auth.uid())
$$;

grant execute on all functions in schema private to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Publicaciones del personal y seguimiento de las tareas
-- ---------------------------------------------------------------------------
create table if not exists public.school_posts (
  id          uuid primary key default gen_random_uuid(),
  kind        text        not null check (kind in ('task', 'resource', 'reminder', 'notice', 'schedule')),
  author_id   uuid references auth.users (id) on delete set null,
  author_name text        not null default '',
  author_role text        not null check (author_role in ('teacher', 'tutor', 'auxiliary')),
  subject     text check (subject is null or char_length(subject) between 2 and 60),
  classrooms  text[]      not null check (private.school_valid_classrooms(classrooms)),
  title       text        not null check (char_length(btrim(title)) between 1 and 160),
  body        text        not null default '' check (char_length(body) <= 6000),
  task_kind   text check (task_kind is null or task_kind in ('Tarea', 'Examen', 'Proyecto', 'Actividad')),
  due_at      timestamptz,
  remind_at   timestamptz,
  url         text check (url is null or (char_length(url) <= 2000 and url ~* '^https?://')),
  attachments jsonb       not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array' and pg_column_size(attachments) < 8192),
  valid_month text check (valid_month is null or valid_month ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  important   boolean     not null default false,
  expires_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index if not exists school_posts_updated_idx    on public.school_posts (updated_at desc);
create index if not exists school_posts_classrooms_idx on public.school_posts using gin (classrooms);
create index if not exists school_posts_author_idx     on public.school_posts (author_id, created_at desc);
create index if not exists school_posts_due_idx        on public.school_posts (due_at) where due_at is not null and deleted_at is null;
alter table public.school_posts enable row level security;

create table if not exists public.school_task_status (
  post_id    uuid not null references public.school_posts (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  classroom  text not null check (classroom ~ '^[345][ABCD]$'),
  state      text not null check (state in ('received', 'in_progress', 'done', 'dismissed')),
  progress   integer not null default 0 check (progress between 0 and 100),
  updated_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index if not exists school_task_status_user_idx on public.school_task_status (user_id);
alter table public.school_task_status enable row level security;

-- ---------------------------------------------------------------------------
-- 6. Disparadores: fechas del servidor, autoría real y retirada del consentimiento
-- ---------------------------------------------------------------------------
create or replace function private.school_touch()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.school_posts_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.created_at := now();
  else
    -- Lo que identifica a la publicación no se reescribe después.
    new.author_id   := old.author_id;
    new.author_role := old.author_role;
    new.kind        := old.kind;
    new.created_at  := old.created_at;
  end if;
  -- El nombre visible sale de la ficha del personal, no de lo que mande el cliente.
  new.author_name := coalesce(
    (select s.full_name from public.school_staff s where s.user_id = new.author_id),
    nullif(new.author_name, ''),
    'Personal del colegio');
  return new;
end;
$$;

create or replace function private.school_members_before_write()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  new.updated_at := now();
  if tg_op = 'INSERT' then
    new.joined_at := now();
  end if;
  if new.share_with_tutor then
    if tg_op = 'INSERT' or not old.share_with_tutor then
      new.consent_at := now();
    end if;
  else
    -- Retirar el consentimiento borra en el acto lo compartido.
    new.consent_at := null;
    new.avatar := null;
    delete from public.school_snapshots where user_id = new.user_id;
  end if;
  return new;
end;
$$;

drop trigger if exists school_posts_before_write on public.school_posts;
create trigger school_posts_before_write before insert or update on public.school_posts
  for each row execute function private.school_posts_before_write();

drop trigger if exists school_members_before_write on public.school_members;
create trigger school_members_before_write before insert or update on public.school_members
  for each row execute function private.school_members_before_write();

drop trigger if exists school_snapshots_touch on public.school_snapshots;
create trigger school_snapshots_touch before insert or update on public.school_snapshots
  for each row execute function private.school_touch();

drop trigger if exists school_task_status_touch on public.school_task_status;
create trigger school_task_status_touch before insert or update on public.school_task_status
  for each row execute function private.school_touch();

drop trigger if exists school_staff_touch on public.school_staff;
create trigger school_staff_touch before update on public.school_staff
  for each row execute function private.school_touch();

-- ---------------------------------------------------------------------------
-- 7. Políticas
-- ---------------------------------------------------------------------------
drop policy if exists school_staff_read on public.school_staff;
create policy school_staff_read on public.school_staff for select to authenticated
  using (active or user_id = (select auth.uid()));

drop policy if exists school_teaching_read   on public.school_teaching;
drop policy if exists school_teaching_insert on public.school_teaching;
drop policy if exists school_teaching_delete on public.school_teaching;
create policy school_teaching_read on public.school_teaching for select to authenticated using (true);
create policy school_teaching_insert on public.school_teaching for insert to authenticated
  with check (user_id = (select auth.uid()) and (select private.school_is_teacher()));
create policy school_teaching_delete on public.school_teaching for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists school_members_read   on public.school_members;
drop policy if exists school_members_insert on public.school_members;
drop policy if exists school_members_update on public.school_members;
drop policy if exists school_members_delete on public.school_members;
create policy school_members_read on public.school_members for select to authenticated
  using (user_id = (select auth.uid()) or classroom = (select private.school_tutor_classroom()));
create policy school_members_insert on public.school_members for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy school_members_update on public.school_members for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy school_members_delete on public.school_members for delete to authenticated
  using (user_id = (select auth.uid()) or classroom = (select private.school_tutor_classroom()));

drop policy if exists school_snapshots_read   on public.school_snapshots;
drop policy if exists school_snapshots_insert on public.school_snapshots;
drop policy if exists school_snapshots_update on public.school_snapshots;
drop policy if exists school_snapshots_delete on public.school_snapshots;
create policy school_snapshots_read on public.school_snapshots for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (
      select 1 from public.school_members m
       where m.user_id = school_snapshots.user_id
         and m.share_with_tutor
         and m.classroom = (select private.school_tutor_classroom()))
  );
create policy school_snapshots_insert on public.school_snapshots for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.school_members m where m.user_id = (select auth.uid()) and m.share_with_tutor)
  );
create policy school_snapshots_update on public.school_snapshots for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.school_members m where m.user_id = (select auth.uid()) and m.share_with_tutor)
  );
create policy school_snapshots_delete on public.school_snapshots for delete to authenticated
  using (user_id = (select auth.uid()));

drop policy if exists school_posts_read   on public.school_posts;
drop policy if exists school_posts_insert on public.school_posts;
drop policy if exists school_posts_update on public.school_posts;
create policy school_posts_read on public.school_posts for select to authenticated
  using (
    author_id = (select auth.uid())
    or (select private.school_is_staff())
    or (select public.is_frame_owner())
    or classrooms && array[coalesce((select private.school_my_classroom()), '-'), 'ALL']
       and (select private.school_my_classroom()) is not null
  );
create policy school_posts_insert on public.school_posts for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and private.school_can_post(kind, author_role, subject, classrooms)
  );
create policy school_posts_update on public.school_posts for update to authenticated
  using (author_id = (select auth.uid()) or (select public.is_frame_owner()))
  with check (
    (select public.is_frame_owner())
    -- Retirar una publicación propia siempre se puede, aunque ya no se dicte esa clase.
    or (author_id = (select auth.uid())
        and (deleted_at is not null or private.school_can_post(kind, author_role, subject, classrooms)))
  );

drop policy if exists school_task_status_read   on public.school_task_status;
drop policy if exists school_task_status_insert on public.school_task_status;
drop policy if exists school_task_status_update on public.school_task_status;
create policy school_task_status_read on public.school_task_status for select to authenticated
  using (
    user_id = (select auth.uid())
    or classroom = (select private.school_tutor_classroom())
    or exists (select 1 from public.school_posts p where p.id = school_task_status.post_id and p.author_id = (select auth.uid()))
  );
create policy school_task_status_insert on public.school_task_status for insert to authenticated
  with check (user_id = (select auth.uid()) and classroom = (select private.school_my_classroom()));
create policy school_task_status_update on public.school_task_status for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()) and classroom = (select private.school_my_classroom()));

-- ---------------------------------------------------------------------------
-- 8. Funciones públicas (RPC)
-- ---------------------------------------------------------------------------
-- El responsable fija o rota el código de una función.
create or replace function public.school_set_code(p_role text, p_code text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  if not public.is_frame_owner() then
    raise exception 'Solo el responsable de Frame puede cambiar los códigos' using errcode = '42501';
  end if;
  if p_role not in ('teacher', 'tutor', 'auxiliary') then
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

-- Solo para el alta del personal desde la función de borde (clave de servicio).
create or replace function public.school_check_code(p_role text, p_code text)
returns boolean language sql stable security definer set search_path = public, extensions as $$
  select exists (
    select 1 from public.school_codes c
     where c.role = p_role and c.code_hash = crypt(coalesce(p_code, ''), c.code_hash))
$$;

-- Una cuenta con sesión presenta el código y obtiene la función.
create or replace function public.school_claim_role(
  p_role text, p_code text, p_full_name text default null, p_classroom text default null)
returns jsonb language plpgsql security definer set search_path = public, extensions as $$
declare
  uid     uuid := auth.uid();
  mail    text := coalesce(auth.jwt() ->> 'email', '');
  stored  text;
  name_in text := nullif(btrim(coalesce(p_full_name, '')), '');
  holder  text;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'error', 'Inicia sesión para continuar.');
  end if;
  if p_role not in ('teacher', 'tutor', 'auxiliary') then
    return jsonb_build_object('ok', false, 'error', 'Función desconocida.');
  end if;

  delete from public.school_code_attempts where at < now() - interval '1 day';
  if (select count(*) from public.school_code_attempts a
       where a.user_id = uid and a.at > now() - interval '15 minutes') >= 8 then
    return jsonb_build_object('ok', false, 'error', 'Demasiados intentos. Espera unos minutos y vuelve a probar.');
  end if;

  select code_hash into stored from public.school_codes where role = p_role;
  if stored is null then
    return jsonb_build_object('ok', false, 'error', 'El responsable de Frame aún no ha habilitado este acceso.');
  end if;
  if stored <> crypt(coalesce(p_code, ''), stored) then
    insert into public.school_code_attempts (user_id) values (uid);
    return jsonb_build_object('ok', false, 'error', 'El código no es correcto.');
  end if;

  if p_role = 'tutor' then
    if coalesce(p_classroom, '') !~ '^[345][ABCD]$' then
      return jsonb_build_object('ok', false, 'error', 'Elige el salón del que eres tutor(a).');
    end if;
    select s.full_name into holder from public.school_staff s
     where s.tutor_classroom = p_classroom and s.user_id <> uid;
    if holder is not null then
      return jsonb_build_object('ok', false, 'error',
        format('El salón %s ya tiene tutor(a): %s. Si es un error, avisa al responsable de Frame.', p_classroom, holder));
    end if;
  end if;

  if not exists (select 1 from public.school_staff where user_id = uid) then
    if name_in is null or char_length(name_in) < 3 then
      return jsonb_build_object('ok', false, 'error', 'Escribe tus nombres y apellidos.');
    end if;
    insert into public.school_staff (user_id, full_name, email) values (uid, left(name_in, 80), mail);
  elsif name_in is not null and char_length(name_in) >= 3 then
    update public.school_staff set full_name = left(name_in, 80) where user_id = uid;
  end if;

  if p_role = 'teacher' then
    update public.school_staff set is_teacher = true where user_id = uid;
  elsif p_role = 'auxiliary' then
    update public.school_staff set is_auxiliary = true where user_id = uid;
  else
    update public.school_staff set is_tutor = true, tutor_classroom = p_classroom where user_id = uid;
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

-- Dejar una función (p. ej. el tutor que cambia de salón la deja y la vuelve a pedir).
create or replace function public.school_leave_role(p_role text)
returns void language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then return; end if;
  if p_role = 'teacher' then
    update public.school_staff set is_teacher = false where user_id = uid;
    delete from public.school_teaching where user_id = uid;
  elsif p_role = 'auxiliary' then
    update public.school_staff set is_auxiliary = false where user_id = uid;
  elsif p_role = 'tutor' then
    update public.school_staff set is_tutor = false, tutor_classroom = null where user_id = uid;
  end if;
end;
$$;

create or replace function public.school_update_staff_name(p_full_name text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if char_length(btrim(coalesce(p_full_name, ''))) < 3 then
    raise exception 'Escribe tus nombres y apellidos';
  end if;
  update public.school_staff set full_name = left(btrim(p_full_name), 80) where user_id = auth.uid();
end;
$$;

-- Panel del responsable: personal (con correo), códigos habilitados y salones.
create or replace function public.school_admin_overview()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare
  result jsonb;
begin
  if not public.is_frame_owner() then
    raise exception 'Solo el responsable de Frame puede consultar esto' using errcode = '42501';
  end if;
  select jsonb_build_object(
    'codes', (select coalesce(jsonb_agg(jsonb_build_object('role', role, 'updated_at', updated_at)), '[]'::jsonb)
                from public.school_codes),
    'staff', (select coalesce(jsonb_agg(jsonb_build_object(
                 'user_id', s.user_id, 'full_name', s.full_name, 'email', s.email,
                 'is_teacher', s.is_teacher, 'is_tutor', s.is_tutor, 'is_auxiliary', s.is_auxiliary,
                 'tutor_classroom', s.tutor_classroom, 'active', s.active, 'created_at', s.created_at,
                 'classes', (select count(*) from public.school_teaching t where t.user_id = s.user_id),
                 'posts', (select count(*) from public.school_posts p where p.author_id = s.user_id and p.deleted_at is null)
               ) order by s.created_at), '[]'::jsonb)
                from public.school_staff s),
    'classrooms', (select coalesce(jsonb_agg(jsonb_build_object(
                 'classroom', c.classroom, 'members', c.members, 'sharing', c.sharing,
                 'tutor', (select s.full_name from public.school_staff s where s.tutor_classroom = c.classroom)
               ) order by c.classroom), '[]'::jsonb)
                from (select classroom, count(*) members, count(*) filter (where share_with_tutor) sharing
                        from public.school_members group by classroom) c),
    'posts', (select coalesce(jsonb_object_agg(kind, n), '{}'::jsonb)
                from (select kind, count(*) n from public.school_posts where deleted_at is null group by kind) k)
  ) into result;
  return result;
end;
$$;

create or replace function public.school_admin_set_staff_active(p_user uuid, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_frame_owner() then
    raise exception 'Solo el responsable de Frame puede hacer esto' using errcode = '42501';
  end if;
  update public.school_staff set active = coalesce(p_active, false) where user_id = p_user;
end;
$$;

create or replace function public.school_admin_release_tutor(p_classroom text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_frame_owner() then
    raise exception 'Solo el responsable de Frame puede hacer esto' using errcode = '42501';
  end if;
  update public.school_staff set is_tutor = false, tutor_classroom = null where tutor_classroom = p_classroom;
end;
$$;

revoke all on function public.school_set_code(text, text)                       from public, anon;
revoke all on function public.school_check_code(text, text)                     from public, anon, authenticated;
revoke all on function public.school_claim_role(text, text, text, text)         from public, anon;
revoke all on function public.school_leave_role(text)                           from public, anon;
revoke all on function public.school_update_staff_name(text)                    from public, anon;
revoke all on function public.school_admin_overview()                           from public, anon;
revoke all on function public.school_admin_set_staff_active(uuid, boolean)      from public, anon;
revoke all on function public.school_admin_release_tutor(text)                  from public, anon;
grant execute on function public.school_set_code(text, text)                    to authenticated;
grant execute on function public.school_check_code(text, text)                  to service_role;
grant execute on function public.school_claim_role(text, text, text, text)      to authenticated;
grant execute on function public.school_leave_role(text)                        to authenticated;
grant execute on function public.school_update_staff_name(text)                 to authenticated;
grant execute on function public.school_admin_overview()                        to authenticated;
grant execute on function public.school_admin_set_staff_active(uuid, boolean)   to authenticated;
grant execute on function public.school_admin_release_tutor(text)               to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Archivos del colegio (adjuntos y fotos de horario): depósito privado
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'school', 'school', false, 10485760,
  array[
    'application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation'
  ]
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists school_files_read   on storage.objects;
drop policy if exists school_files_insert on storage.objects;
drop policy if exists school_files_delete on storage.objects;
create policy school_files_read on storage.objects for select to authenticated
  using (
    bucket_id = 'school'
    and ((select private.school_is_staff()) or (select private.school_my_classroom()) is not null)
  );
create policy school_files_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'school'
    and (select private.school_is_staff())
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
create policy school_files_delete on storage.objects for delete to authenticated
  using (
    bucket_id = 'school'
    and ((storage.foldername(name))[1] = (select auth.uid())::text or (select public.is_frame_owner()))
  );

-- ---------------------------------------------------------------------------
-- 10. Telemetría: salón y tipo de cuenta, para medir la adopción por salón
-- ---------------------------------------------------------------------------
alter table public.telemetry_users add column if not exists classroom text
  check (classroom is null or classroom ~ '^[345][ABCD]$');
alter table public.telemetry_users add column if not exists is_guest boolean;
