-- ============================================================
-- 0009 · Sugerencias y reseñas (Frame 1.5.8 / Android 1.0.10)
--
-- Botón «Sugerencias» de la barra superior (y la invitación a calificar que
-- sale una vez por versión): cualquier usuario —cuenta o invitado— envía una
-- calificación de 1 a 5 estrellas y un texto con formato. Solo el
-- responsable de Frame (is_frame_owner) las lee, desde ese mismo botón.
--
-- Nadie toca la tabla directamente (RLS sin políticas): todo pasa por
-- funciones que validan, limitan y añaden en el servidor el resumen de uso
-- del remitente (país, sistema, versión, tiempo de uso, tareas…), sacado de
-- la telemetría seudónima, no de lo que diga el cliente.
-- ============================================================

create table if not exists public.feedback (
  id          uuid        primary key default gen_random_uuid(),
  user_id     text        not null,
  username    text        not null default 'Usuario',
  rating      smallint    not null check (rating between 1 and 5),
  body_html   text        not null default '',
  body_text   text        not null default '',
  source      text        not null default 'boton' check (source in ('boton', 'invitacion')),
  app_version text,
  platform    text,
  country     text,
  stats       jsonb       not null default '{}'::jsonb,
  created_at  timestamptz not null default now(),
  read_at     timestamptz
);
create index if not exists feedback_created_idx on public.feedback (created_at desc);
create index if not exists feedback_user_idx on public.feedback (user_id, created_at desc);
alter table public.feedback enable row level security;

-- Enviar: cuentas (su uid) e invitados (su id local de 12 cifras).
create or replace function public.feedback_submit(p jsonb)
returns uuid
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_uid    text := coalesce(auth.uid()::text, left(coalesce(p ->> 'user_id', ''), 64));
  v_rating int  := case when (p ->> 'rating') ~ '^[1-5]$' then (p ->> 'rating')::int else null end;
  v_html   text := left(coalesce(p ->> 'html', ''), 30000);
  v_text   text := left(coalesce(p ->> 'text', ''), 12000);
  v_source text := case when p ->> 'source' = 'invitacion' then 'invitacion' else 'boton' end;
  v_user   record;
  v_id     uuid;
begin
  if char_length(v_uid) < 6 then
    raise exception 'Falta el identificador' using errcode = '22023';
  end if;
  if v_rating is null then
    raise exception 'La calificación debe estar entre 1 y 5 estrellas' using errcode = '22023';
  end if;
  -- Tope razonable: 6 envíos por persona y día.
  if (select count(*) from public.feedback
       where user_id = v_uid and created_at > now() - interval '1 day') >= 6 then
    raise exception 'Has enviado muchas sugerencias hoy. Vuelve a intentarlo mañana.' using errcode = '54000';
  end if;

  select * into v_user from public.telemetry_users where user_id = v_uid;

  insert into public.feedback (user_id, username, rating, body_html, body_text, source, app_version, platform, country, stats)
  values (
    v_uid,
    coalesce(nullif(left(trim(coalesce(p ->> 'username', '')), 40), ''), 'Usuario'),
    v_rating,
    v_html,
    v_text,
    v_source,
    coalesce(left(p ->> 'app_version', 20), v_user.app_version),
    coalesce(left(p ->> 'platform', 20), v_user.platform),
    v_user.country,
    jsonb_strip_nulls(jsonb_build_object(
      'is_guest',   coalesce(v_user.is_guest, (p ->> 'is_guest')::boolean),
      'first_seen', v_user.first_seen,
      'last_seen',  v_user.last_seen,
      'minutes',    v_user.total_study_minutes,
      'sessions',   v_user.total_study_sessions,
      'tasks',      v_user.total_tasks_completed,
      'courses',    v_user.total_courses,
      'habits',     v_user.total_habits,
      'songs',      v_user.total_songs,
      'member_since', nullif(left(coalesce(p ->> 'member_since', ''), 40), '')
    ))
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- Leer: solo el responsable. Se completan los datos con la telemetría actual.
create or replace function public.feedback_list()
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not public.is_frame_owner() then
    raise exception 'Solo el responsable de Frame puede leer las sugerencias' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', f.id,
      'username', f.username,
      'rating', f.rating,
      'html', f.body_html,
      'text', f.body_text,
      'source', f.source,
      'created_at', f.created_at,
      'read', f.read_at is not null,
      'app_version', coalesce(u.app_version, f.app_version),
      'platform', coalesce(u.platform, f.platform),
      'country', coalesce(u.country, f.country),
      'is_guest', coalesce(u.is_guest, (f.stats ->> 'is_guest')::boolean, false),
      'first_seen', coalesce(u.first_seen::text, f.stats ->> 'first_seen'),
      'last_seen', coalesce(u.last_seen::text, f.stats ->> 'last_seen'),
      'member_since', f.stats ->> 'member_since',
      'minutes', coalesce(u.total_study_minutes, (f.stats ->> 'minutes')::int),
      'sessions', coalesce(u.total_study_sessions, (f.stats ->> 'sessions')::int),
      'tasks', coalesce(u.total_tasks_completed, (f.stats ->> 'tasks')::int),
      'courses', coalesce(u.total_courses, (f.stats ->> 'courses')::int),
      'habits', coalesce(u.total_habits, (f.stats ->> 'habits')::int),
      'songs', coalesce(u.total_songs, (f.stats ->> 'songs')::int)
    ) order by f.created_at desc)
    from public.feedback f
    left join public.telemetry_users u on u.user_id = f.user_id
  ), '[]'::jsonb);
end;
$$;

create or replace function public.feedback_unread_count()
returns integer
language plpgsql
stable
security definer
set search_path to ''
as $$
begin
  if not public.is_frame_owner() then
    return 0;
  end if;
  return (select count(*) from public.feedback where read_at is null);
end;
$$;

create or replace function public.feedback_mark_read()
returns void
language plpgsql
security definer
set search_path to ''
as $$
begin
  if not public.is_frame_owner() then
    raise exception 'Solo el responsable de Frame' using errcode = '42501';
  end if;
  update public.feedback set read_at = now() where read_at is null;
end;
$$;

revoke all on function public.feedback_submit(jsonb) from public;
revoke all on function public.feedback_list() from public;
revoke all on function public.feedback_unread_count() from public;
revoke all on function public.feedback_mark_read() from public;
grant execute on function public.feedback_submit(jsonb) to anon, authenticated;
grant execute on function public.feedback_list() to authenticated;
grant execute on function public.feedback_unread_count() to authenticated;
grant execute on function public.feedback_mark_read() to authenticated;
