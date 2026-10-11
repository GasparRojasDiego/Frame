-- =============================================================================
-- Frame · Eventos de uso, lectura del responsable y resumen agregado
-- =============================================================================
-- APLICADA el 18-sep-2026 al proyecto `egshmkkmvtsrgrfwpzog` (junto con la
-- función de 0001, que hasta entonces nunca se había desplegado). Este archivo
-- deja constancia del esquema para poder reconstruirlo; es idempotente.
--
-- Qué hace:
--   1. `telemetry_events`: hechos con fecha (la app se abrió, se registró una
--      sesión, se terminó una tarea…). La app SOLO escribe.
--   2. `is_frame_owner()` + políticas `*_owner_read`: el único que puede LEER
--      la telemetría es la sesión cuyo JWT lleva el correo del responsable.
--   3. `usage_overview(days)`: el resumen que pinta la interfaz «Uso». Es
--      SECURITY INVOKER a propósito: si el control explícito fallara, la RLS
--      seguiría sin dejar ver ni una fila a nadie más.
--
-- Para cambiar de responsable: editar el correo en `is_frame_owner()` (y la
-- constante OWNER_EMAIL de src/lib/owner.ts, que solo decide qué se dibuja).
-- =============================================================================

create table if not exists public.telemetry_events (
  id          bigint generated always as identity primary key,
  user_id     text        not null,
  event       text        not null,
  props       jsonb       not null default '{}'::jsonb,
  app_version text,
  platform    text,
  created_at  timestamptz not null default now()
);
create index if not exists telemetry_events_created_idx      on public.telemetry_events (created_at desc);
create index if not exists telemetry_events_user_created_idx on public.telemetry_events (user_id, created_at desc);
create index if not exists telemetry_events_event_idx        on public.telemetry_events (event, created_at desc);
alter table public.telemetry_events enable row level security;

drop policy if exists telemetry_events_insert on public.telemetry_events;
create policy telemetry_events_insert on public.telemetry_events
  for insert to anon, authenticated
  with check (
    char_length(user_id) between 1 and 64
    and char_length(event) between 1 and 64
    and pg_column_size(props) < 4096
  );

create or replace function public.is_frame_owner()
returns boolean
language sql
stable
set search_path = public
as $$
  -- En el repositorio va un marcador: al aplicar, poner el correo del responsable.
  select coalesce(lower(auth.jwt() ->> 'email') = 'correo-del-responsable@ejemplo.com', false)
$$;

drop policy if exists telemetry_users_owner_read  on public.telemetry_users;
drop policy if exists telemetry_weekly_owner_read on public.telemetry_weekly;
drop policy if exists telemetry_events_owner_read on public.telemetry_events;
create policy telemetry_users_owner_read  on public.telemetry_users  for select to authenticated using (public.is_frame_owner());
create policy telemetry_weekly_owner_read on public.telemetry_weekly for select to authenticated using (public.is_frame_owner());
create policy telemetry_events_owner_read on public.telemetry_events for select to authenticated using (public.is_frame_owner());

create or replace function public.usage_overview(days integer default 30)
returns jsonb
language plpgsql
stable
security invoker
set search_path = public
as $$
declare
  span      integer := greatest(coalesce(days, 30), 1);
  today     date    := (now() at time zone 'America/Lima')::date;
  since     date    := today - (span - 1);
  since_ts  timestamptz := (since::timestamp at time zone 'America/Lima');
  week_now  date    := date_trunc('week', today)::date;
  week_prev date    := week_now - 7;
  result    jsonb;
begin
  if not public.is_frame_owner() then
    raise exception 'Solo el responsable de Frame puede consultar el panel de uso'
      using errcode = '42501';
  end if;

  with
  active_dates as (
    select user_id, (created_at at time zone 'America/Lima')::date as d
      from public.telemetry_events
     where created_at >= since_ts - interval '7 days'
    union
    select user_id, (last_seen at time zone 'America/Lima')::date
      from public.telemetry_users
     where last_seen >= since_ts - interval '7 days'
  ),
  days_series as (
    select generate_series(since, today, interval '1 day')::date as d
  ),
  daily as (
    select ds.d,
           (select count(distinct a.user_id) from active_dates a where a.d = ds.d)                        as active_users,
           (select count(*) from public.telemetry_events e
             where e.event = 'study_session_end' and (e.created_at at time zone 'America/Lima')::date = ds.d) as sessions,
           (select coalesce(sum((e.props ->> 'minutes')::numeric), 0) from public.telemetry_events e
             where e.event = 'study_session_end' and (e.created_at at time zone 'America/Lima')::date = ds.d) as minutes,
           (select count(*) from public.telemetry_events e
             where e.event = 'task_completed' and (e.created_at at time zone 'America/Lima')::date = ds.d)  as tasks,
           (select count(*) from public.telemetry_events e
             where e.event = 'app_open' and (e.created_at at time zone 'America/Lima')::date = ds.d)        as opens
      from days_series ds
  ),
  week_users as (
    select
      (select count(distinct user_id) from active_dates where d >= week_now)                     as this_week,
      (select count(distinct user_id) from active_dates where d >= week_prev and d < week_now)   as prev_week,
      (select count(distinct a.user_id) from active_dates a
        where a.d >= week_now
          and exists (select 1 from active_dates b where b.user_id = a.user_id and b.d >= week_prev and b.d < week_now)) as retained
  )
  select jsonb_build_object(
    'generated_at', now(),
    'days', span,
    'since', since,
    'today', today,
    'totals', jsonb_build_object(
      'users_total',      (select count(*) from public.telemetry_users),
      'users_new',        (select count(*) from public.telemetry_users where first_seen >= since_ts),
      'active_today',     (select count(distinct user_id) from active_dates where d = today),
      'active_7d',        (select count(distinct user_id) from active_dates where d >= today - 6),
      'active_30d',       (select count(distinct user_id) from active_dates where d >= today - 29),
      'sessions_period',  (select coalesce(sum(sessions), 0) from daily),
      'minutes_period',   (select coalesce(sum(minutes), 0) from daily),
      'tasks_period',     (select coalesce(sum(tasks), 0) from daily),
      'opens_period',     (select coalesce(sum(opens), 0) from daily),
      'errors_period',    (select count(*) from public.telemetry_events where event = 'error' and created_at >= since_ts),
      'study_minutes_all',(select coalesce(sum(total_study_minutes), 0) from public.telemetry_users),
      'sessions_all',     (select coalesce(sum(total_study_sessions), 0) from public.telemetry_users),
      'tasks_all',        (select coalesce(sum(total_tasks_completed), 0) from public.telemetry_users)
    ),
    'retention', (select jsonb_build_object('this_week', this_week, 'prev_week', prev_week, 'retained', retained) from week_users),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
                'date', d, 'active_users', active_users, 'sessions', sessions,
                'minutes', minutes, 'tasks', tasks, 'opens', opens) order by d), '[]'::jsonb) from daily),
    'versions', (select coalesce(jsonb_agg(jsonb_build_object('version', coalesce(app_version, '?'), 'users', n) order by n desc), '[]'::jsonb)
                   from (select app_version, count(*) n from public.telemetry_users group by app_version) v),
    'countries', (select coalesce(jsonb_agg(jsonb_build_object('country', coalesce(country, 'Desconocido'), 'users', n) order by n desc), '[]'::jsonb)
                    from (select country, count(*) n from public.telemetry_users group by country) c),
    'platforms', (select coalesce(jsonb_agg(jsonb_build_object('platform', coalesce(platform, '?'), 'users', n) order by n desc), '[]'::jsonb)
                    from (select platform, count(*) n from public.telemetry_users group by platform) p),
    'screens', (select coalesce(jsonb_agg(jsonb_build_object('screen', screen, 'views', n, 'users', u) order by n desc), '[]'::jsonb)
                  from (select props ->> 'screen' as screen, count(*) n, count(distinct user_id) u
                          from public.telemetry_events
                         where event = 'screen_view' and created_at >= since_ts
                         group by props ->> 'screen') s),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('event', event, 'count', n, 'users', u) order by n desc), '[]'::jsonb)
                 from (select event, count(*) n, count(distinct user_id) u
                         from public.telemetry_events
                        where created_at >= since_ts
                        group by event) e),
    'reports', (select coalesce(jsonb_agg(jsonb_build_object('format', fmt, 'count', n) order by n desc), '[]'::jsonb)
                  from (select coalesce(props ->> 'format', '?') fmt, count(*) n
                          from public.telemetry_events
                         where event = 'report_generated' and created_at >= since_ts
                         group by props ->> 'format') r),
    'weekly', (select coalesce(jsonb_agg(jsonb_build_object(
                 'week_start', week_start, 'users', users, 'sessions', sessions, 'minutes', minutes, 'tasks', tasks) order by week_start), '[]'::jsonb)
                 from (select week_start, count(distinct user_id) users, sum(study_sessions) sessions,
                              sum(study_minutes) minutes, sum(tasks_completed) tasks
                         from public.telemetry_weekly
                        where week_start >= today - 8 * 7
                        group by week_start) w),
    'recent_users', (select coalesce(jsonb_agg(jsonb_build_object(
                       'id', left(user_id, 6) || '…', 'country', country, 'version', app_version, 'platform', platform,
                       'first_seen', first_seen, 'last_seen', last_seen,
                       'minutes', total_study_minutes, 'sessions', total_study_sessions,
                       'tasks', total_tasks_completed, 'courses', total_courses, 'habits', total_habits) order by last_seen desc), '[]'::jsonb)
                       from (select * from public.telemetry_users order by last_seen desc limit 40) ru),
    'recent_errors', (select coalesce(jsonb_agg(jsonb_build_object(
                        'at', created_at, 'version', app_version, 'message', left(props ->> 'message', 240),
                        'scope', props ->> 'scope') order by created_at desc), '[]'::jsonb)
                        from (select * from public.telemetry_events where event = 'error' order by created_at desc limit 25) re)
  ) into result;

  return result;
end;
$$;

revoke all    on function public.usage_overview(integer) from public, anon;
grant execute on function public.usage_overview(integer) to authenticated;

-- El borrado de cuenta (0001) purga también los eventos del usuario:
--   delete from public.telemetry_events where user_id = uid::text;
-- (ya incluido en la versión desplegada de `delete_current_user`).
