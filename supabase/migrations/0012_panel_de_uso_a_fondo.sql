-- ============================================================
-- 0012 · Panel de uso a fondo (Frame 1.6.9 / móvil 1.1.5)
--
-- Pedido de Diego (13-oct-2026): un panel que, con un público grande, reúna
-- todo lo útil para acreditar el impacto de Frame, sin vulnerar la
-- privacidad de nadie. Y sin castigar la base de datos: el panel se calcula
-- como mucho cada 6 horas (o cuando el responsable pulsa «Actualizar ahora»).
--
-- 1. telemetry_users gana lo que cada app ya sabe de sí misma, siempre
--    agregado o aproximado (nunca el contenido de nada):
--      · lugar aproximado: ciudad, región, país y su código (el del clima de
--        Inicio, que el usuario ve y puede cambiar);
--      · zona horaria, idioma de Frame, idioma del sistema y tipo de equipo;
--      · cuándo estudia: minutos por día de la semana y hora local (7 × 24),
--        duración de las sesiones (5 tramos) y enfoque declarado (5 tramos);
--      · rachas (actual y mejor) y cuántos elementos tiene de cada función.
--    `telemetry_report` los valida (longitudes, rangos, zona horaria real).
--
-- 2. usage_snapshots: una sola fila con el panel ya calculado. La lee
--    `usage_snapshot(max_age_hours, force)`: si tiene menos de esas horas, la
--    devuelve tal cual (una lectura); si no, la recalcula. Sin políticas: solo
--    la tocan las funciones, que exigen la cuenta del responsable.
--
-- 3. usage_user_detail(targets): lo que se ve al abrir la tarjeta de un
--    estudiante (y lo que lleva el reporte): cuándo estudia, sus semanas,
--    cuándo abre Frame y sus últimos eventos.
--
-- 4. delete_current_user también borra la foto del panel: quien elimina su
--    cuenta desaparece de él en el acto, no a las 6 horas.
--
-- La cuenta del responsable sigue fuera de todas las cifras (0008).
-- ============================================================

-- ------------------------------------------------------------
-- 1. Más datos por estudiante
-- ------------------------------------------------------------
alter table public.telemetry_users
  add column if not exists city            text,
  add column if not exists region          text,
  add column if not exists country_code    text,
  add column if not exists timezone        text,
  add column if not exists lang            text,
  add column if not exists locale          text,
  add column if not exists device          text,
  add column if not exists study_matrix    integer[],
  add column if not exists session_lengths integer[],
  add column if not exists focus_counts    integer[],
  add column if not exists features        jsonb,
  add column if not exists streak          integer,
  add column if not exists best_streak     integer,
  add column if not exists profile_at      timestamptz;

-- Un arreglo de exactamente `n` enteros entre 0 y `top`; si no, null.
create or replace function private.tints(p jsonb, n integer, top integer)
returns integer[]
language sql
immutable
set search_path to ''
as $$
  select case
    when jsonb_typeof(p) = 'array' and jsonb_array_length(p) = n then
      (select array_agg(least(greatest(
                case when x #>> '{}' ~ '^\d{1,9}$' then (x #>> '{}')::integer else 0 end, 0), top) order by i)
         from jsonb_array_elements(p) with ordinality as t(x, i))
    else null
  end
$$;

-- Contadores por función: claves cortas en minúscula, valores enteros acotados.
create or replace function private.tfeatures(p jsonb)
returns jsonb
language sql
immutable
set search_path to ''
as $$
  select case
    when jsonb_typeof(p) = 'object' then
      (select coalesce(jsonb_object_agg(k, private.tint(p, k, 1000000)), '{}'::jsonb)
         from (select k from jsonb_object_keys(p) k where k ~ '^[a-z][a-z_]{0,23}$' limit 40) keys)
    else null
  end
$$;

-- Texto corto y limpio (sin saltos de línea ni controles).
create or replace function private.ttext(p jsonb, k text, top integer)
returns text
language sql
immutable
set search_path to ''
as $$
  select nullif(left(regexp_replace(coalesce(p ->> k, ''), '[[:cntrl:]]', '', 'g'), top), '')
$$;

create or replace function public.telemetry_report(p jsonb)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  uid  text := left(coalesce(p ->> 'user_id', ''), 64);
  room text := case when (p ->> 'classroom') ~ '^[345][ABCD]$' then p ->> 'classroom' else null end;
  tot  jsonb := coalesce(p -> 'totals', '{}'::jsonb);
  pro  jsonb := case when jsonb_typeof(p -> 'profile') = 'object' then p -> 'profile' else null end;
  zone text := private.ttext(p -> 'profile', 'timezone', 64);
begin
  if char_length(uid) < 6 or pg_column_size(p) > 65536 then
    return;
  end if;
  -- Una zona horaria inventada rompería los cálculos por hora local del panel.
  if zone is not null and not exists (select 1 from pg_timezone_names where name = zone) then
    zone := null;
  end if;

  insert into public.telemetry_users as u (
    user_id, country, app_version, platform, last_seen,
    total_study_minutes, total_study_sessions, total_tasks_completed,
    total_songs, total_courses, total_playlists, total_habits, classroom, is_guest,
    city, region, country_code, timezone, lang, locale, device,
    study_matrix, session_lengths, focus_counts, features, streak, best_streak, profile_at)
  values (
    uid, nullif(left(coalesce(p ->> 'country', ''), 60), ''), left(coalesce(p ->> 'app_version', ''), 20),
    left(coalesce(p ->> 'platform', ''), 20), now(),
    private.tint(tot, 'minutes', 10000000), private.tint(tot, 'sessions', 1000000), private.tint(tot, 'tasks', 1000000),
    private.tint(tot, 'songs', 1000000), private.tint(tot, 'courses', 10000), private.tint(tot, 'playlists', 10000),
    private.tint(tot, 'habits', 10000), room, (p ->> 'is_guest')::boolean,
    private.ttext(pro, 'city', 80), private.ttext(pro, 'region', 80),
    case when upper(coalesce(pro ->> 'country_code', '')) ~ '^[A-Z]{2}$' then upper(pro ->> 'country_code') else null end,
    zone,
    case when pro ->> 'lang' in ('es', 'en') then pro ->> 'lang' else null end,
    case when coalesce(pro ->> 'locale', '') ~ '^[A-Za-z]{2,3}(-[A-Za-z0-9]{2,8}){0,2}$' then pro ->> 'locale' else null end,
    case when pro ->> 'device' in ('desktop', 'tablet', 'phone') then pro ->> 'device' else null end,
    private.tints(pro -> 'matrix', 168, 100000),
    private.tints(pro -> 'slen', 5, 100000),
    private.tints(pro -> 'focus', 5, 100000),
    private.tfeatures(pro -> 'features'),
    case when pro is null then null else private.tint(pro, 'streak', 100000) end,
    case when pro is null then null else private.tint(pro, 'best_streak', 100000) end,
    case when pro is null then null else now() end)
  on conflict (user_id) do update set
    country               = coalesce(excluded.country, u.country),
    app_version           = excluded.app_version,
    platform              = excluded.platform,
    last_seen             = now(),
    total_study_minutes   = excluded.total_study_minutes,
    total_study_sessions  = excluded.total_study_sessions,
    total_tasks_completed = excluded.total_tasks_completed,
    total_songs           = excluded.total_songs,
    total_courses         = excluded.total_courses,
    total_playlists       = excluded.total_playlists,
    total_habits          = excluded.total_habits,
    classroom             = excluded.classroom,
    is_guest              = coalesce(excluded.is_guest, u.is_guest),
    -- Versiones anteriores no mandan el perfil: lo que ya había se conserva.
    city            = case when excluded.profile_at is null then u.city else excluded.city end,
    region          = case when excluded.profile_at is null then u.region else excluded.region end,
    country_code    = coalesce(excluded.country_code, u.country_code),
    timezone        = coalesce(excluded.timezone, u.timezone),
    lang            = coalesce(excluded.lang, u.lang),
    locale          = coalesce(excluded.locale, u.locale),
    device          = coalesce(excluded.device, u.device),
    study_matrix    = coalesce(excluded.study_matrix, u.study_matrix),
    session_lengths = coalesce(excluded.session_lengths, u.session_lengths),
    focus_counts    = coalesce(excluded.focus_counts, u.focus_counts),
    features        = coalesce(excluded.features, u.features),
    streak          = coalesce(excluded.streak, u.streak),
    best_streak     = greatest(excluded.best_streak, u.best_streak),
    profile_at      = coalesce(excluded.profile_at, u.profile_at);

  insert into public.telemetry_weekly as w (
    user_id, week_start, study_sessions, study_minutes, tasks_completed, songs_added,
    active_days, focus_avg, tasks_high, tasks_on_time, tasks_with_due, habits_rate, updated_at)
  select
    uid, (x ->> 'week_start')::date,
    private.tint(x, 'sessions', 5000), private.tint(x, 'minutes', 20000), private.tint(x, 'tasks', 5000),
    private.tint(x, 'songs_added', 100000), private.tint(x, 'active_days', 7),
    case when (x ->> 'focus_avg') ~ '^\d{1,2}(\.\d+)?$' then least((x ->> 'focus_avg')::numeric, 20) else null end,
    private.tint(x, 'tasks_high', 5000), private.tint(x, 'tasks_on_time', 5000), private.tint(x, 'tasks_with_due', 5000),
    case when (x ->> 'habits_rate') ~ '^\d{1,3}$' then least((x ->> 'habits_rate')::integer, 100) else null end,
    now()
  from (select x from jsonb_array_elements(coalesce(p -> 'weeks', '[]'::jsonb)) x limit 30) weeks
  where (x ->> 'week_start') ~ '^\d{4}-\d{2}-\d{2}$'
    and (x ->> 'week_start')::date between date '2024-01-01' and (now() + interval '7 days')::date
  on conflict (user_id, week_start) do update set
    study_sessions  = excluded.study_sessions,
    study_minutes   = excluded.study_minutes,
    tasks_completed = greatest(excluded.tasks_completed, w.tasks_completed),
    songs_added     = greatest(excluded.songs_added, w.songs_added),
    active_days     = excluded.active_days,
    focus_avg       = excluded.focus_avg,
    tasks_high      = greatest(excluded.tasks_high, w.tasks_high),
    tasks_on_time   = greatest(excluded.tasks_on_time, w.tasks_on_time),
    tasks_with_due  = greatest(excluded.tasks_with_due, w.tasks_with_due),
    habits_rate     = excluded.habits_rate,
    updated_at      = now();

  insert into public.telemetry_daily as d (
    user_id, day, minutes, sessions, focus_avg, tasks, tasks_high, tasks_on_time, tasks_with_due,
    habits_done, habits_possible, updated_at)
  select
    uid, (x ->> 'd')::date,
    private.tint(x, 'm', 1440), private.tint(x, 's', 200),
    case when (x ->> 'f') ~ '^\d{1,2}(\.\d+)?$' then least((x ->> 'f')::numeric, 20) else null end,
    private.tint(x, 't', 500), private.tint(x, 'th', 500), private.tint(x, 'to', 500), private.tint(x, 'td', 500),
    private.tint(x, 'hd', 200), private.tint(x, 'hp', 200), now()
  from (select x from jsonb_array_elements(coalesce(p -> 'days', '[]'::jsonb)) x limit 200) days
  where (x ->> 'd') ~ '^\d{4}-\d{2}-\d{2}$'
    and (x ->> 'd')::date between date '2024-01-01' and (now() + interval '1 day')::date
  on conflict (user_id, day) do update set
    minutes         = excluded.minutes,
    sessions        = excluded.sessions,
    focus_avg       = excluded.focus_avg,
    tasks           = greatest(excluded.tasks, d.tasks),
    tasks_high      = greatest(excluded.tasks_high, d.tasks_high),
    tasks_on_time   = greatest(excluded.tasks_on_time, d.tasks_on_time),
    tasks_with_due  = greatest(excluded.tasks_with_due, d.tasks_with_due),
    habits_done     = excluded.habits_done,
    habits_possible = excluded.habits_possible,
    updated_at      = now();
end;
$function$;

-- ------------------------------------------------------------
-- 2. La foto del panel
-- ------------------------------------------------------------
create table if not exists public.usage_snapshots (
  id           smallint primary key default 1 check (id = 1),
  generated_at timestamptz not null default now(),
  data         jsonb not null
);
alter table public.usage_snapshots enable row level security;
-- Sin políticas a propósito: nadie la lee ni la escribe directamente.

-- Los días van como número desde el 1-ene-2024 (más corto que una fecha) y en
-- la hora de Perú, como el resto del panel desde la 1.5.0.
create or replace function private.build_usage_snapshot(me text)
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  tz        constant text := 'America/Lima';
  epoch     constant date := date '2024-01-01';
  today     date := (now() at time zone tz)::date;
  since     date := today - 399;
  since_ts  timestamptz := (since::timestamp at time zone tz);
  result    jsonb;
begin
  with
  tu as (select * from public.telemetry_users where user_id <> me),
  te as (
    select e.user_id, e.event, e.props, e.created_at, (e.created_at at time zone tz)::date - epoch as dn
      from public.telemetry_events e
     where e.user_id <> me and e.created_at >= since_ts
  ),
  td as (select d.*, d.day - epoch as dn from public.telemetry_daily d where d.user_id <> me and d.day >= since),
  active as (
    select user_id, dn from te
    union select user_id, dn from td
    union select user_id, (last_seen at time zone tz)::date - epoch from tu where last_seen >= since_ts
  ),
  opens as (
    -- Cuándo se abre Frame, en la hora LOCAL de cada estudiante (lun = 0).
    select ((extract(isodow from te.created_at at time zone coalesce(u.timezone, tz))::int - 1) * 24
            + extract(hour from te.created_at at time zone coalesce(u.timezone, tz))::int) as slot
      from te join tu u on u.user_id = te.user_id
     where te.event = 'app_open'
  ),
  -- Una pasada por tabla, agrupada por estudiante (no una búsqueda por cada uno).
  active_by as (
    select user_id, jsonb_agg(dn order by dn) as a from (select distinct user_id, dn from active) x group by user_id
  ),
  daily_by as (
    select user_id, jsonb_agg(jsonb_build_array(dn, minutes, sessions, tasks, tasks_on_time, tasks_with_due, tasks_high,
                                                habits_done, habits_possible, focus_avg) order by dn) as d
      from td group by user_id
  ),
  events_by as (
    select user_id, jsonb_object_agg(event, n) as e
      from (select user_id, event, count(*) as n from te group by user_id, event) x group by user_id
  ),
  screens_by as (
    select user_id, jsonb_object_agg(screen, n) as sc
      from (select user_id, props ->> 'screen' as screen, count(*) as n from te
             where event = 'screen_view' and props ->> 'screen' is not null
             group by user_id, props ->> 'screen') x group by user_id
  )
  select jsonb_build_object(
    'v', 1,
    'generated_at', now(),
    'tz', tz,
    'epoch', epoch,
    'today', today - epoch,
    'since', since - epoch,
    'users', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', u.user_id,
        'g', coalesce(u.is_guest, false),
        'n', p.username,
        'cc', u.country_code, 'co', u.country, 'ci', u.city, 're', u.region,
        'tz', u.timezone, 'la', u.lang, 'lo', u.locale, 'dv', u.device,
        'pl', u.platform, 've', u.app_version,
        'fs', u.first_seen, 'ls', u.last_seen,
        't', jsonb_build_array(u.total_study_minutes, u.total_study_sessions, u.total_tasks_completed,
                               u.total_songs, u.total_courses, u.total_playlists, u.total_habits),
        'f', u.features, 'st', u.streak, 'bs', u.best_streak,
        'sl', u.session_lengths, 'fo', u.focus_counts, 'mx', u.study_matrix,
        'a', coalesce(ab.a, '[]'::jsonb),
        'd', coalesce(db.d, '[]'::jsonb),
        'e', coalesce(eb.e, '{}'::jsonb),
        'sc', coalesce(sb.sc, '{}'::jsonb)
      ) order by u.last_seen desc), '[]'::jsonb)
        from tu u
        left join public.profiles p on not coalesce(u.is_guest, false) and p.id::text = u.user_id
        left join active_by ab on ab.user_id = u.user_id
        left join daily_by db on db.user_id = u.user_id
        left join events_by eb on eb.user_id = u.user_id
        left join screens_by sb on sb.user_id = u.user_id
    ),
    'ev', (
      select coalesce(jsonb_object_agg(x.event, x.days), '{}'::jsonb)
        from (select event, jsonb_agg(jsonb_build_array(dn, n, users) order by dn) as days
                from (select event, dn, count(*) as n, count(distinct user_id) as users from te group by event, dn) per_day
               group by event) x
    ),
    'sc', (
      select coalesce(jsonb_object_agg(x.screen, x.days), '{}'::jsonb)
        from (select screen, jsonb_agg(jsonb_build_array(dn, n, users) order by dn) as days
                from (select props ->> 'screen' as screen, dn, count(*) as n, count(distinct user_id) as users
                        from te where event = 'screen_view' and props ->> 'screen' is not null
                       group by props ->> 'screen', dn) per_day
               group by screen) x
    ),
    'reports', (
      select coalesce(jsonb_object_agg(x.fmt, x.n), '{}'::jsonb)
        from (select coalesce(props ->> 'format', '?') as fmt, count(*) as n from te
               where event = 'report_generated' group by props ->> 'format') x
    ),
    'mx_open', (
      select coalesce(jsonb_agg(coalesce(o.n, 0) order by g.slot), '[]'::jsonb)
        from generate_series(0, 167) g(slot)
        left join (select slot, count(*) as n from opens group by slot) o on o.slot = g.slot
    ),
    'errors', (
      select jsonb_build_object(
        'open',    count(*) filter (where status = 'abierto'),
        'fixed',   count(*) filter (where status = 'corregido'),
        'ignored', count(*) filter (where status = 'ignorado'),
        'top', (select coalesce(jsonb_agg(jsonb_build_object(
                  'scope', scope, 'name', name, 'message', left(message, 160), 'n', occurrences,
                  'users', coalesce(array_length(array_remove(user_ids, me), 1), 0),
                  'last', last_seen, 'versions', versions) order by occurrences desc), '[]'::jsonb)
                  from (select * from public.error_log where status = 'abierto' order by occurrences desc limit 8) top)
      )
        from public.error_log
    )
  ) into result;
  return result;
end;
$$;
revoke all on function private.build_usage_snapshot(text) from public, anon, authenticated;

create or replace function public.usage_snapshot(max_age_hours integer default 6, force boolean default false)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $$
declare
  me    text := coalesce(auth.uid()::text, '');
  hours integer := least(greatest(coalesce(max_age_hours, 6), 1), 168);
  snap  public.usage_snapshots%rowtype;
  fresh jsonb;
begin
  if not public.is_frame_owner() then
    raise exception 'Solo el responsable de Frame puede consultar el panel de uso' using errcode = '42501';
  end if;
  select * into snap from public.usage_snapshots where id = 1;
  if found and not coalesce(force, false) and snap.generated_at > now() - make_interval(hours => hours) then
    return snap.data;
  end if;
  fresh := private.build_usage_snapshot(me);
  insert into public.usage_snapshots (id, generated_at, data) values (1, now(), fresh)
    on conflict (id) do update set generated_at = excluded.generated_at, data = excluded.data;
  return fresh;
end;
$$;
revoke all on function public.usage_snapshot(integer, boolean) from public, anon;
grant execute on function public.usage_snapshot(integer, boolean) to authenticated;

-- ------------------------------------------------------------
-- 3. La tarjeta de cada estudiante (y el reporte)
-- ------------------------------------------------------------
create or replace function public.usage_user_detail(targets text[])
returns jsonb
language plpgsql
stable
security definer
set search_path to ''
as $$
declare
  me text := coalesce(auth.uid()::text, '');
  tz constant text := 'America/Lima';
begin
  if not public.is_frame_owner() then
    raise exception 'Solo el responsable de Frame puede consultar el panel de uso' using errcode = '42501';
  end if;
  return (
    select coalesce(jsonb_object_agg(u.user_id, jsonb_build_object(
      'mx', u.study_matrix,
      'weeks', (select coalesce(jsonb_agg(jsonb_build_array(w.week_start, w.study_minutes, w.study_sessions, w.active_days,
                                                            w.tasks_completed, w.tasks_on_time, w.tasks_with_due, w.focus_avg,
                                                            w.habits_rate) order by w.week_start), '[]'::jsonb)
                  from public.telemetry_weekly w where w.user_id = u.user_id),
      'opens', (select coalesce(jsonb_agg(coalesce(o.n, 0) order by g.slot), '[]'::jsonb)
                  from generate_series(0, 167) g(slot)
                  left join (select ((extract(isodow from e.created_at at time zone coalesce(u.timezone, tz))::int - 1) * 24
                                     + extract(hour from e.created_at at time zone coalesce(u.timezone, tz))::int) as slot,
                                    count(*) as n
                               from public.telemetry_events e
                              where e.user_id = u.user_id and e.event = 'app_open'
                              group by 1) o on o.slot = g.slot),
      'recent', (select coalesce(jsonb_agg(jsonb_build_object(
                    'at', e.created_at, 'e', e.event, 'v', e.app_version,
                    's', e.props ->> 'screen', 'f', e.props ->> 'format', 'p', e.props ->> 'priority',
                    'm', e.props ->> 'minutes') order by e.created_at desc), '[]'::jsonb)
                   from (select * from public.telemetry_events
                          where user_id = u.user_id and event <> 'error'
                          order by created_at desc limit 60) e)
    )), '{}'::jsonb)
      from public.telemetry_users u
     where u.user_id = any (targets[1:200]) and u.user_id <> me
  );
end;
$$;
revoke all on function public.usage_user_detail(text[]) from public, anon;
grant execute on function public.usage_user_detail(text[]) to authenticated;

-- ------------------------------------------------------------
-- 4. Eliminar la cuenta: también fuera de la foto del panel
-- ------------------------------------------------------------
create or replace function public.delete_current_user()
returns void
language plpgsql
security definer
set search_path to 'public', 'auth'
as $function$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'No hay sesión activa';
  end if;

  delete from public.backups          where user_id = uid;
  delete from public.telemetry_events where user_id = uid::text;
  delete from public.telemetry_daily  where user_id = uid::text;
  delete from public.telemetry_weekly where user_id = uid::text;
  delete from public.telemetry_users  where user_id = uid::text;
  delete from public.profiles         where id      = uid;
  -- La foto del panel la lleva dentro: se borra y el panel la recalcula sin ella.
  delete from public.usage_snapshots;

  -- Debe ir al final: borrar la identidad invalida el JWT en curso.
  delete from auth.users              where id      = uid;
end;
$function$;
