-- ============================================================
-- 0008 · Panel de uso limpio y registro automático de errores (Frame 1.5.7)
--
-- 1. La cuenta del responsable deja de contar en las métricas. Él es quien
--    más usa Frame y sus cifras inflaban todo. Las tres funciones del panel
--    solo responden a esa cuenta (is_frame_owner), así que basta con apartar
--    `auth.uid()`: quien consulta ES el responsable.
--
-- 2. usage_overview gana lo que pide un panel ordenado: reparto de
--    estudiantes por actividad reciente y por horas de estudio, cuentas
--    frente a invitados, días activos en el periodo de cada estudiante y la
--    lista completa (la interfaz la pagina). `recent_errors` sigue en la
--    respuesta por compatibilidad con la 1.5.6, pero vacío: los errores ya
--    no se miran en el panel.
--
-- 3. error_log: cada evento 'error' que llega a telemetry_events se agrupa
--    solo (disparador) por huella — ámbito + nombre + mensaje sin números
--    ni identificadores —, con primera y última vez, veces, estudiantes,
--    versiones, plataformas, ruta y pila. Estados: abierto / corregido /
--    ignorado. Si un error marcado como corregido reaparece en una versión
--    igual o posterior a la del arreglo, se reabre solo. Los avisos
--    inofensivos del navegador (bucle de ResizeObserver) entran ignorados.
--    Solo el responsable puede leerlo o cambiar su estado.
-- ============================================================

-- ------------------------------------------------------------
-- Utilidades privadas
-- ------------------------------------------------------------

-- '1.5.10' >= '1.5.9' comparando números, no texto.
create or replace function private.version_ge(a text, b text)
returns boolean
language sql
immutable
set search_path to ''
as $$
  select case
    when coalesce(a, '') !~ '^\d+(\.\d+)*$' or coalesce(b, '') !~ '^\d+(\.\d+)*$' then false
    else string_to_array(a, '.')::int[] >= string_to_array(b, '.')::int[]
  end
$$;

-- Huella estable de un error: el mismo fallo con otro número o id dentro del
-- mensaje es el mismo fallo.
create or replace function private.error_fingerprint(scope text, name text, message text)
returns text
language sql
immutable
set search_path to ''
as $$
  select md5(
    coalesce(scope, '') || '|' || coalesce(name, '') || '|' ||
    regexp_replace(
      regexp_replace(lower(coalesce(message, '')), '[0-9a-f]{8}(-?[0-9a-f]{4}){3}-?[0-9a-f]{12}|[0-9a-f]{12,}', '<id>', 'g'),
      '\d+', '<n>', 'g')
  )
$$;

-- ------------------------------------------------------------
-- Registro de errores
-- ------------------------------------------------------------

create table if not exists public.error_log (
  fingerprint text primary key,
  scope       text,
  name        text,
  message     text        not null default '',
  route       text,
  stack       text,
  first_seen  timestamptz not null default now(),
  last_seen   timestamptz not null default now(),
  occurrences integer     not null default 1,
  user_ids    text[]      not null default '{}',
  versions    text[]      not null default '{}',
  platforms   text[]      not null default '{}',
  status      text        not null default 'abierto' check (status in ('abierto', 'corregido', 'ignorado')),
  -- Versión que trae el arreglo, por plataforma: {"windows": "1.5.7", "android": "1.0.10"}
  fixed_in    jsonb       not null default '{}'::jsonb,
  resolution  text,
  updated_at  timestamptz not null default now()
);
create index if not exists error_log_status_seen_idx on public.error_log (status, last_seen desc);
alter table public.error_log enable row level security;

drop policy if exists error_log_owner_read on public.error_log;
drop policy if exists error_log_owner_update on public.error_log;
create policy error_log_owner_read on public.error_log
  for select to authenticated using (public.is_frame_owner());
create policy error_log_owner_update on public.error_log
  for update to authenticated using (public.is_frame_owner()) with check (public.is_frame_owner());

create or replace function private.record_error(
  p_user text, p_version text, p_platform text, p_props jsonb, p_at timestamptz)
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_scope   text := left(p_props ->> 'scope', 40);
  v_name    text := left(p_props ->> 'name', 80);
  v_message text := left(coalesce(p_props ->> 'message', ''), 500);
  v_route   text := nullif(left(coalesce(p_props ->> 'route', ''), 120), '');
  v_stack   text := nullif(left(coalesce(p_props ->> 'stack', ''), 2000), '');
  v_fp      text := private.error_fingerprint(v_scope, v_name, v_message);
  v_benign  boolean := v_message ~* '(resizeobserver loop|^script error\.?$)';
  v_at      timestamptz := coalesce(p_at, now());
begin
  insert into public.error_log as l (
    fingerprint, scope, name, message, route, stack, first_seen, last_seen,
    user_ids, versions, platforms, status, resolution)
  values (
    v_fp, v_scope, v_name, v_message, v_route, v_stack, v_at, v_at,
    array[p_user],
    case when p_version is null then '{}' else array[p_version] end,
    case when p_platform is null then '{}' else array[p_platform] end,
    case when v_benign then 'ignorado' else 'abierto' end,
    case when v_benign then 'Aviso inofensivo del navegador: no rompe nada.' end)
  on conflict (fingerprint) do update set
    last_seen   = greatest(l.last_seen, v_at),
    occurrences = l.occurrences + 1,
    route       = coalesce(v_route, l.route),
    stack       = coalesce(v_stack, l.stack),
    user_ids    = case when p_user = any(l.user_ids) or cardinality(l.user_ids) >= 200
                       then l.user_ids else l.user_ids || p_user end,
    versions    = case when p_version is null or p_version = any(l.versions)
                       then l.versions else l.versions || p_version end,
    platforms   = case when p_platform is null or p_platform = any(l.platforms)
                       then l.platforms else l.platforms || p_platform end,
    status      = case when l.status = 'corregido' and p_platform is not null
                            and l.fixed_in ? p_platform
                            and private.version_ge(p_version, l.fixed_in ->> p_platform)
                       then 'abierto' else l.status end,
    resolution  = case when l.status = 'corregido' and p_platform is not null
                            and l.fixed_in ? p_platform
                            and private.version_ge(p_version, l.fixed_in ->> p_platform)
                       then concat_ws(' · ', l.resolution, 'Reapareció en ' || p_version || ' (' || p_platform || ')')
                       else l.resolution end,
    updated_at  = now();
end;
$$;

create or replace function private.on_error_event()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  perform private.record_error(new.user_id, new.app_version, new.platform, new.props, new.created_at);
  return new;
end;
$$;

drop trigger if exists telemetry_events_error_log on public.telemetry_events;
create trigger telemetry_events_error_log
  after insert on public.telemetry_events
  for each row when (new.event = 'error')
  execute function private.on_error_event();

-- ------------------------------------------------------------
-- Panel de uso
-- ------------------------------------------------------------

create or replace function public.usage_overview(days integer default 30)
returns jsonb
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  span      integer := greatest(coalesce(days, 30), 1);
  today     date    := (now() at time zone 'America/Lima')::date;
  since     date    := today - (span - 1);
  since_ts  timestamptz := (since::timestamp at time zone 'America/Lima');
  week_now  date    := date_trunc('week', today)::date;
  week_prev date    := week_now - 7;
  me        text    := coalesce(auth.uid()::text, '');
  result    jsonb;
begin
  if not public.is_frame_owner() then
    raise exception 'Solo el responsable de Frame puede consultar el panel de uso'
      using errcode = '42501';
  end if;

  with
  tu as (select * from public.telemetry_users where user_id <> me),
  te as (select * from public.telemetry_events where user_id <> me and created_at >= since_ts - interval '14 days'),
  active_dates as (
    select user_id, (created_at at time zone 'America/Lima')::date as d from te
    union
    select user_id, (last_seen at time zone 'America/Lima')::date from tu
     where last_seen >= since_ts - interval '14 days'
  ),
  days_series as (
    select generate_series(since, today, interval '1 day')::date as d
  ),
  daily as (
    select ds.d,
           (select count(distinct a.user_id) from active_dates a where a.d = ds.d) as active_users,
           (select count(*) from te e
             where e.event = 'study_session_end' and (e.created_at at time zone 'America/Lima')::date = ds.d) as sessions,
           (select coalesce(sum((e.props ->> 'minutes')::numeric), 0) from te e
             where e.event = 'study_session_end' and (e.created_at at time zone 'America/Lima')::date = ds.d) as minutes,
           (select count(*) from te e
             where e.event = 'task_completed' and (e.created_at at time zone 'America/Lima')::date = ds.d) as tasks,
           (select count(*) from te e
             where e.event = 'app_open' and (e.created_at at time zone 'America/Lima')::date = ds.d) as opens
      from days_series ds
  ),
  week_users as (
    select
      (select count(distinct user_id) from active_dates where d >= week_now) as this_week,
      (select count(distinct user_id) from active_dates where d >= week_prev and d < week_now) as prev_week,
      (select count(distinct a.user_id) from active_dates a
        where a.d >= week_now
          and exists (select 1 from active_dates b where b.user_id = a.user_id and b.d >= week_prev and b.d < week_now)) as retained
  ),
  period_users as (
    select user_id, count(distinct d) as active_days from active_dates where d >= since group by user_id
  ),
  recency as (
    select u.user_id,
           today - (u.last_seen at time zone 'America/Lima')::date as days_ago
      from tu u
  )
  select jsonb_build_object(
    'generated_at', now(),
    'days', span,
    'since', since,
    'today', today,
    'totals', jsonb_build_object(
      'users_total',       (select count(*) from tu),
      'accounts_total',    (select count(*) from tu where not coalesce(is_guest, false)),
      'guests_total',      (select count(*) from tu where coalesce(is_guest, false)),
      'users_new',         (select count(*) from tu where first_seen >= since_ts),
      'active_today',      (select count(distinct user_id) from active_dates where d = today),
      'active_7d',         (select count(distinct user_id) from active_dates where d >= today - 6),
      'active_30d',        (select count(distinct user_id) from active_dates where d >= today - 29),
      'active_period',     (select count(*) from period_users),
      'sessions_period',   (select coalesce(sum(sessions), 0) from daily),
      'minutes_period',    (select coalesce(sum(minutes), 0) from daily),
      'tasks_period',      (select coalesce(sum(tasks), 0) from daily),
      'opens_period',      (select coalesce(sum(opens), 0) from daily),
      'errors_period',     0,
      'study_minutes_all', (select coalesce(sum(total_study_minutes), 0) from tu),
      'sessions_all',      (select coalesce(sum(total_study_sessions), 0) from tu),
      'tasks_all',         (select coalesce(sum(total_tasks_completed), 0) from tu)
    ),
    'retention', (select jsonb_build_object('this_week', this_week, 'prev_week', prev_week, 'retained', retained) from week_users),
    -- Cuántos estudiantes hay en cada tramo de «última vez».
    'recency', (select jsonb_build_object(
                  'today',  count(*) filter (where days_ago <= 0),
                  'week',   count(*) filter (where days_ago between 1 and 6),
                  'month',  count(*) filter (where days_ago between 7 and 29),
                  'older',  count(*) filter (where days_ago >= 30)) from recency),
    -- Cuántos estudiantes hay en cada tramo de estudio acumulado.
    'study_buckets', (select jsonb_build_object(
                        'none',  count(*) filter (where coalesce(total_study_minutes, 0) = 0),
                        'lt1h',  count(*) filter (where total_study_minutes between 1 and 59),
                        'h1_5',  count(*) filter (where total_study_minutes between 60 and 299),
                        'h5_20', count(*) filter (where total_study_minutes between 300 and 1199),
                        'h20',   count(*) filter (where total_study_minutes >= 1200)) from tu),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
                'date', d, 'active_users', active_users, 'sessions', sessions,
                'minutes', minutes, 'tasks', tasks, 'opens', opens) order by d), '[]'::jsonb) from daily),
    'versions', (select coalesce(jsonb_agg(jsonb_build_object('version', coalesce(app_version, '?'), 'platform', coalesce(platform, '?'), 'users', n) order by n desc), '[]'::jsonb)
                   from (select app_version, platform, count(*) n from tu group by app_version, platform) v),
    'countries', (select coalesce(jsonb_agg(jsonb_build_object('country', coalesce(country, 'Desconocido'), 'users', n) order by n desc), '[]'::jsonb)
                    from (select country, count(*) n from tu group by country) c),
    'platforms', (select coalesce(jsonb_agg(jsonb_build_object('platform', coalesce(platform, '?'), 'users', n) order by n desc), '[]'::jsonb)
                    from (select platform, count(*) n from tu group by platform) p),
    'screens', (select coalesce(jsonb_agg(jsonb_build_object('screen', screen, 'views', n, 'users', u) order by n desc), '[]'::jsonb)
                  from (select props ->> 'screen' as screen, count(*) n, count(distinct user_id) u
                          from te
                         where event = 'screen_view' and created_at >= since_ts
                         group by props ->> 'screen') s),
    'events', (select coalesce(jsonb_agg(jsonb_build_object('event', event, 'count', n, 'users', u) order by n desc), '[]'::jsonb)
                 from (select event, count(*) n, count(distinct user_id) u
                         from te
                        where created_at >= since_ts and event <> 'error'
                        group by event) e),
    'reports', (select coalesce(jsonb_agg(jsonb_build_object('format', fmt, 'count', n) order by n desc), '[]'::jsonb)
                  from (select coalesce(props ->> 'format', '?') fmt, count(*) n
                          from te
                         where event = 'report_generated' and created_at >= since_ts
                         group by props ->> 'format') r),
    'weekly', (select coalesce(jsonb_agg(jsonb_build_object(
                 'week_start', week_start, 'users', users, 'sessions', sessions, 'minutes', minutes, 'tasks', tasks) order by week_start), '[]'::jsonb)
                 from (select week_start, count(distinct user_id) users, sum(study_sessions) sessions,
                              sum(study_minutes) minutes, sum(tasks_completed) tasks
                         from public.telemetry_weekly
                        where user_id <> me and week_start >= today - 8 * 7
                        group by week_start) w),
    -- La lista completa (la interfaz la ordena y pagina). El id va recortado:
    -- basta para distinguir a dos estudiantes, no para identificar a nadie.
    'users', (select coalesce(jsonb_agg(jsonb_build_object(
                'id', left(u.user_id, 6) || '…', 'guest', coalesce(u.is_guest, false),
                'country', u.country, 'version', u.app_version, 'platform', u.platform,
                'first_seen', u.first_seen, 'last_seen', u.last_seen,
                'minutes', u.total_study_minutes, 'sessions', u.total_study_sessions,
                'tasks', u.total_tasks_completed, 'courses', u.total_courses, 'habits', u.total_habits,
                'songs', u.total_songs, 'active_days', coalesce(p.active_days, 0)) order by u.last_seen desc), '[]'::jsonb)
                from (select * from tu order by last_seen desc limit 500) u
                left join period_users p on p.user_id = u.user_id),
    -- Compatibilidad con Frame 1.5.6, que aún pinta estas dos claves.
    'recent_users', (select coalesce(jsonb_agg(jsonb_build_object(
                       'id', left(user_id, 6) || '…', 'country', country, 'version', app_version, 'platform', platform,
                       'first_seen', first_seen, 'last_seen', last_seen,
                       'minutes', total_study_minutes, 'sessions', total_study_sessions,
                       'tasks', total_tasks_completed, 'courses', total_courses, 'habits', total_habits) order by last_seen desc), '[]'::jsonb)
                       from (select * from tu order by last_seen desc limit 15) ru),
    'recent_errors', '[]'::jsonb
  ) into result;

  return result;
end;
$function$;

create or replace function public.guest_overview(days integer default 30)
returns jsonb
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  span     integer := greatest(coalesce(days, 30), 1);
  today    date    := (now() at time zone 'America/Lima')::date;
  since    date    := today - (span - 1);
  since_ts timestamptz := (since::timestamp at time zone 'America/Lima');
  me       text    := coalesce(auth.uid()::text, '');
begin
  if not public.is_frame_owner() then
    raise exception 'Solo el responsable de Frame puede consultar el panel de uso'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'started_period', (select count(distinct user_id) from public.telemetry_events
                        where event = 'guest_started' and user_id <> me and created_at >= since_ts),
    'started_today',  (select count(distinct user_id) from public.telemetry_events
                        where event = 'guest_started' and user_id <> me
                          and (created_at at time zone 'America/Lima')::date = today),
    'resumed_period', (select count(*) from public.telemetry_events
                        where event = 'guest_started' and user_id <> me and created_at >= since_ts
                          and coalesce((props ->> 'resumed')::boolean, false)),
    'linked_period',  (select count(distinct user_id) from public.telemetry_events
                        where event = 'guest_linked' and user_id <> me and created_at >= since_ts),
    'linked_today',   (select count(distinct user_id) from public.telemetry_events
                        where event = 'guest_linked' and user_id <> me
                          and (created_at at time zone 'America/Lima')::date = today),
    'guests_total',   (select count(*) from public.telemetry_users where is_guest and user_id <> me),
    'guests_active_7d', (select count(distinct e.user_id)
                           from public.telemetry_events e
                           join public.telemetry_users u on u.user_id = e.user_id
                          where u.is_guest and e.user_id <> me and e.created_at >= now() - interval '7 days'),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
                'date', ds.d,
                'started', (select count(distinct user_id) from public.telemetry_events
                             where event = 'guest_started' and user_id <> me
                               and (created_at at time zone 'America/Lima')::date = ds.d),
                'linked',  (select count(distinct user_id) from public.telemetry_events
                             where event = 'guest_linked' and user_id <> me
                               and (created_at at time zone 'America/Lima')::date = ds.d)
              ) order by ds.d), '[]'::jsonb)
                from (select generate_series(since, today, interval '1 day')::date as d) ds)
  );
end;
$function$;

create or replace function public.impact_overview()
returns jsonb
language plpgsql
stable
set search_path to 'public'
as $function$
declare
  today  date := (now() at time zone 'America/Lima')::date;
  me     text := coalesce(auth.uid()::text, '');
  result jsonb;
begin
  if not public.is_frame_owner() then
    raise exception 'Solo el responsable de Frame puede consultar el impacto' using errcode = '42501';
  end if;

  with td as (
    select * from public.telemetry_daily where user_id <> me
  ),
  firsts as (
    select user_id, min(day) as d0 from td where minutes > 0 or tasks > 0 group by user_id
  ),
  rel as (
    select t.*, f.d0, ((t.day - f.d0) / 7) + 1 as wk
      from td t join firsts f using (user_id)
     where t.day >= f.d0
  ),
  per_user_week as (
    select user_id, wk,
           sum(minutes) as minutes, sum(sessions) as sessions,
           count(*) filter (where minutes > 0) as active_days,
           sum(tasks) as tasks,
           avg(focus_avg) filter (where focus_avg is not null) as focus
      from rel where wk between 1 and 12 group by user_id, wk
  ),
  observable as (
    select f.user_id, g.wk from firsts f cross join generate_series(1, 12) as g(wk)
     where f.d0 + (g.wk * 7) <= today
  ),
  grid as (
    select o.user_id, o.wk,
           coalesce(p.minutes, 0) as minutes, coalesce(p.sessions, 0) as sessions,
           coalesce(p.active_days, 0) as active_days, coalesce(p.tasks, 0) as tasks, p.focus
      from observable o left join per_user_week p on p.user_id = o.user_id and p.wk = o.wk
  ),
  cohort as (
    select wk,
           count(*) as users_observable,
           count(*) filter (where minutes > 0 or tasks > 0) as users_active,
           round(avg(minutes)) as avg_minutes,
           round((percentile_cont(0.5) within group (order by minutes))::numeric) as median_minutes,
           round(avg(focus)::numeric, 1) as avg_focus,
           round(avg(active_days)::numeric, 1) as avg_active_days,
           sum(tasks) as tasks
      from grid group by wk
  ),
  pair12 as (
    select a.minutes as m1, b.minutes as m2 from grid a join grid b on b.user_id = a.user_id and b.wk = 2 where a.wk = 1 and a.minutes > 0
  ),
  pair14 as (
    select a.minutes as m1, b.minutes as m2 from grid a join grid b on b.user_id = a.user_id and b.wk = 4 where a.wk = 1 and a.minutes > 0
  )
  select jsonb_build_object(
    'generated_at', now(),
    'today', today,
    'headline', jsonb_build_object(
      'students',       (select count(*) from firsts),
      'students_2w',    (select count(*) from (select user_id from per_user_week where minutes > 0 or tasks > 0 group by user_id having count(*) >= 2) x),
      'first_day',      (select min(d0) from firsts),
      'minutes',        (select coalesce(sum(minutes), 0) from td),
      'sessions',       (select coalesce(sum(sessions), 0) from td),
      'study_days',     (select count(*) from td where minutes > 0),
      'tasks',          (select coalesce(sum(tasks), 0) from td),
      'tasks_high',     (select coalesce(sum(tasks_high), 0) from td),
      'tasks_with_due', (select coalesce(sum(tasks_with_due), 0) from td),
      'tasks_on_time',  (select coalesce(sum(tasks_on_time), 0) from td),
      'focus_avg',      (select round(avg(focus_avg)::numeric, 1) from td where focus_avg is not null),
      'habits_rate',    (select case when sum(habits_possible) > 0 then round(100.0 * sum(habits_done) / sum(habits_possible)) end from td)
    ),
    'cohort', (select coalesce(jsonb_agg(to_jsonb(c) order by c.wk), '[]'::jsonb) from cohort c),
    'w1_w2', (select jsonb_build_object(
                'n', count(*), 'sum_w1', coalesce(sum(m1), 0), 'sum_w2', coalesce(sum(m2), 0),
                'mean_w1', round(avg(m1)), 'mean_w2', round(avg(m2)),
                'median_change_pct', round((percentile_cont(0.5) within group (order by (m2 - m1) * 100.0 / m1))::numeric),
                'improved', count(*) filter (where m2 > m1)) from pair12),
    'w1_w4', (select jsonb_build_object(
                'n', count(*), 'sum_w1', coalesce(sum(m1), 0), 'sum_w2', coalesce(sum(m2), 0),
                'mean_w1', round(avg(m1)), 'mean_w2', round(avg(m2)),
                'median_change_pct', round((percentile_cont(0.5) within group (order by (m2 - m1) * 100.0 / m1))::numeric),
                'improved', count(*) filter (where m2 > m1)) from pair14),
    'by_classroom', (select coalesce(jsonb_agg(jsonb_build_object(
                       'classroom', c.classroom, 'students', c.n, 'minutes', c.minutes, 'tasks', c.tasks) order by c.classroom), '[]'::jsonb)
                       from (select coalesce(u.classroom, 'Sin salón') as classroom, count(distinct u.user_id) as n,
                                    coalesce(sum(d.minutes), 0) as minutes, coalesce(sum(d.tasks), 0) as tasks
                               from public.telemetry_users u left join td d on d.user_id = u.user_id
                              where u.user_id <> me
                              group by 1) c),
    'calendar_weeks', (select coalesce(jsonb_agg(jsonb_build_object(
                         'week_start', cw.w, 'users', cw.users, 'minutes', cw.minutes, 'tasks', cw.tasks) order by cw.w), '[]'::jsonb)
                         from (select date_trunc('week', day)::date as w, count(distinct user_id) as users,
                                      sum(minutes) as minutes, sum(tasks) as tasks
                                 from td where day >= today - 7 * 16 group by 1) cw)
  ) into result;

  return result;
end;
$function$;
