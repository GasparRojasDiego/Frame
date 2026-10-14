-- ============================================================
-- 0013 · Métricas fuera de la app y telemetría acotada (Frame 1.7.0 / móvil 1.1.6)
--
-- APLICADA el 13-oct-2026 (con el visto bueno de Diego). Comprobado: la foto
-- del panel sale idéntica antes y después de compactar; sin el código del
-- autenticador (aal1) el responsable no ve nada; el tope guardó 500 de 522.
--
-- Pedido de Diego (13-oct-2026): el Panel de uso sale de la app a una página
-- web aparte, privada y segura; y Frame, a punto de llegar a un público
-- grande, no debe llenar la base de datos (plan gratuito: 500 MB).
--
-- 1. El responsable, solo con el segundo paso: `is_frame_owner()` exige además
--    una sesión verificada con el código del autenticador (aal2). La página de
--    métricas lo pide; con la sesión de la app (aal1) ya no se ve nada.
-- 2. Telemetría acotada. Medido el 13-oct: ~16 eventos por estudiante y día,
--    ~540 B cada uno con sus índices (8,6 kB por estudiante y día). Con mil
--    estudiantes activos serían más de 3 GB al año. Así:
--      · cada evento suelto vive 14 días; después se compacta en UNA fila por
--        estudiante y día (`private.telemetry_event_days`, ~20 veces menos);
--      · lo de diagnóstico se borra a los 12 meses (Política de privacidad, §7);
--      · un equipo desbocado no llena la base: hasta 500 eventos al día por
--        instalación, y ni fechas futuras ni de hace más de 30 días;
--      · `telemetry_report` ya no reescribe los días y semanas que no cambiaron
--        (cada informe mandaba hasta 140 días y los volvía a escribir todos).
-- 3. La foto del panel se recalcula sola cada 6 h (pg_cron), sin el límite de
--    8 s de las peticiones; la página solo la descarga si cambió (`known`).
-- 4. Fuera las funciones del panel viejo (usage_overview, guest_overview).
-- 5. Eliminar la cuenta también borra sus días compactados y su rastro en el
--    registro de errores; la foto del panel se vacía y se recalcula sin ella.
--
-- El correo del responsable NO está en este archivo: el punto 1 retoca la
-- función que ya existe, sea cual sea el correo que lleve.
-- ============================================================

-- ------------------------------------------------------------
-- 1. El responsable, solo con el código del autenticador (aal2)
-- ------------------------------------------------------------
do $$
declare
  def text := pg_get_functiondef('public.is_frame_owner()'::regprocedure);
begin
  if position('aal2' in def) = 0 then
    def := replace(def, $q$', false)$q$, $q$' and (auth.jwt() ->> 'aal') = 'aal2', false)$q$);
    if position('aal2' in def) = 0 then
      raise exception 'is_frame_owner() no tiene la forma esperada; revísala a mano';
    end if;
    execute def;
  end if;
end;
$$;

-- ------------------------------------------------------------
-- 2. Telemetría acotada
-- ------------------------------------------------------------

-- Una fila por estudiante y día (día de Perú, como el panel) con lo que dejaron
-- sus eventos sueltos al compactarse: veces de cada evento, de cada interfaz y
-- de cada formato de informe, y la franja (lun 0 … dom 167, hora local) de
-- cada apertura. En `private`: fuera del alcance de la API.
create table if not exists private.telemetry_event_days (
  user_id text     not null,
  day     date     not null,
  ev      jsonb    not null default '{}'::jsonb,
  sc      jsonb    not null default '{}'::jsonb,
  rep     jsonb    not null default '{}'::jsonb,
  opens   smallint[] not null default '{}',
  primary key (user_id, day)
);
alter table private.telemetry_event_days enable row level security;
revoke all on table private.telemetry_event_days from public, anon, authenticated;

-- Suma dos recuentos {clave: veces}.
create or replace function private.jsonb_add(a jsonb, b jsonb)
returns jsonb
language sql
immutable
set search_path to ''
as $$
  select coalesce(jsonb_object_agg(key, total), '{}'::jsonb)
    from (select key, sum(value::bigint)::bigint as total
            from (select * from jsonb_each(coalesce(a, '{}'::jsonb))
                  union all
                  select * from jsonb_each(coalesce(b, '{}'::jsonb))) x
           group by key) y
$$;

-- Mueve los eventos de hace más de `keep_days` días a su fila del día, en una
-- sola sentencia: cada evento está o suelto o compactado, nunca en los dos.
-- Uno que llegue tarde (la cola de un equipo sin conexión) se suma la noche
-- siguiente a la fila que ya existía.
create or replace function private.compact_telemetry(keep_days integer default 14)
returns integer
language plpgsql
security definer
set search_path to ''
as $$
declare
  tz     constant text := 'America/Lima';
  cutoff timestamptz := (((now() at time zone tz)::date - greatest(keep_days, 1))::timestamp at time zone tz);
  moved  integer;
begin
  with gone as (
    delete from public.telemetry_events e
     where e.created_at < cutoff
    returning e.user_id, e.event, e.props, e.created_at
  ),
  tagged as (
    select g.user_id, (g.created_at at time zone tz)::date as day, g.event, g.props,
           case when g.event = 'app_open' then
             ((extract(isodow from g.created_at at time zone coalesce(u.timezone, tz))::int - 1) * 24
              + extract(hour from g.created_at at time zone coalesce(u.timezone, tz))::int)::smallint
           end as slot
      from gone g
      left join public.telemetry_users u on u.user_id = g.user_id
  ),
  ev as (
    select user_id, day, jsonb_object_agg(event, n) as ev
      from (select user_id, day, event, count(*) as n from tagged group by user_id, day, event) x
     group by user_id, day
  ),
  sc as (
    select user_id, day, jsonb_object_agg(screen, n) as sc
      from (select user_id, day, props ->> 'screen' as screen, count(*) as n from tagged
             where event = 'screen_view' and props ->> 'screen' is not null
             group by user_id, day, props ->> 'screen') x
     group by user_id, day
  ),
  rep as (
    select user_id, day, jsonb_object_agg(fmt, n) as rep
      from (select user_id, day, coalesce(props ->> 'format', '?') as fmt, count(*) as n from tagged
             where event = 'report_generated'
             group by user_id, day, coalesce(props ->> 'format', '?')) x
     group by user_id, day
  ),
  op as (
    select user_id, day, array_agg(slot order by slot) as opens from tagged where slot is not null group by user_id, day
  )
  insert into private.telemetry_event_days as c (user_id, day, ev, sc, rep, opens)
  select ev.user_id, ev.day, ev.ev, coalesce(sc.sc, '{}'::jsonb), coalesce(rep.rep, '{}'::jsonb), coalesce(op.opens, '{}')
    from ev
    left join sc  on sc.user_id  = ev.user_id and sc.day  = ev.day
    left join rep on rep.user_id = ev.user_id and rep.day = ev.day
    left join op  on op.user_id  = ev.user_id and op.day  = ev.day
  on conflict (user_id, day) do update set
    ev    = private.jsonb_add(c.ev, excluded.ev),
    sc    = private.jsonb_add(c.sc, excluded.sc),
    rep   = private.jsonb_add(c.rep, excluded.rep),
    opens = c.opens || excluded.opens;
  get diagnostics moved = row_count;
  return moved;
end;
$$;
revoke all on function private.compact_telemetry(integer) from public, anon, authenticated;

-- Política de privacidad, §7: datos de diagnóstico, máximo doce meses.
create or replace function private.prune_diagnostics()
returns void
language sql
security definer
set search_path to ''
as $$
  delete from public.telemetry_events      where created_at < now() - interval '12 months';
  delete from private.telemetry_event_days where day < (now() - interval '12 months')::date;
  delete from public.telemetry_daily       where day < (now() - interval '12 months')::date;
  delete from public.telemetry_weekly      where week_start < (now() - interval '12 months')::date;
  delete from public.telemetry_users       where last_seen < now() - interval '12 months';
  delete from public.error_log             where last_seen < now() - interval '12 months';
$$;
revoke all on function private.prune_diagnostics() from public, anon, authenticated;

-- La hora la pone el equipo (la cola guarda la del momento del evento): ni
-- futura ni de hace más de 30 días. Y un equipo que repita un evento sin
-- parar (un fallo) no llena la base: hasta 500 al día por instalación. Lo que
-- sobra se descarta en silencio: el equipo lo da por enviado y no reintenta.
-- SECURITY DEFINER: para contar hay que ver las filas, y la app no puede.
create or replace function private.telemetry_event_guard()
returns trigger
language plpgsql
security definer
set search_path to ''
as $$
begin
  if new.created_at is null or new.created_at > now() then
    new.created_at := now();
  end if;
  if new.created_at < now() - interval '30 days' then
    return null;
  end if;
  if (select count(*) from public.telemetry_events e
       where e.user_id = new.user_id and e.created_at > now() - interval '1 day') >= 500 then
    return null;
  end if;
  return new;
end;
$$;
revoke all on function private.telemetry_event_guard() from public, anon, authenticated;
drop trigger if exists telemetry_events_guard on public.telemetry_events;
create trigger telemetry_events_guard
  before insert on public.telemetry_events
  for each row execute function private.telemetry_event_guard();

-- El informe de cada equipo (cada 6 h como mucho) manda sus últimos 140 días
-- y 16 semanas. Antes se reescribían todos aunque no hubiera cambiado nada:
-- ahora solo los que cambiaron (el resto ni se toca).
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
    updated_at      = now()
  where (w.study_sessions, w.study_minutes, w.tasks_completed, w.songs_added, w.active_days,
         w.focus_avg, w.tasks_high, w.tasks_on_time, w.tasks_with_due, w.habits_rate)
        is distinct from
        (excluded.study_sessions, excluded.study_minutes, greatest(excluded.tasks_completed, w.tasks_completed),
         greatest(excluded.songs_added, w.songs_added), excluded.active_days, excluded.focus_avg,
         greatest(excluded.tasks_high, w.tasks_high), greatest(excluded.tasks_on_time, w.tasks_on_time),
         greatest(excluded.tasks_with_due, w.tasks_with_due), excluded.habits_rate);

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
    updated_at      = now()
  where (d.minutes, d.sessions, d.focus_avg, d.tasks, d.tasks_high, d.tasks_on_time, d.tasks_with_due,
         d.habits_done, d.habits_possible)
        is distinct from
        (excluded.minutes, excluded.sessions, excluded.focus_avg, greatest(excluded.tasks, d.tasks),
         greatest(excluded.tasks_high, d.tasks_high), greatest(excluded.tasks_on_time, d.tasks_on_time),
         greatest(excluded.tasks_with_due, d.tasks_with_due), excluded.habits_done, excluded.habits_possible);
end;
$function$;

-- ------------------------------------------------------------
-- 3. La foto del panel, con lo suelto y lo compactado
-- ------------------------------------------------------------
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
  tc as (
    select c.user_id, c.ev, c.sc, c.rep, c.opens, c.day - epoch as dn
      from private.telemetry_event_days c
     where c.user_id <> me and c.day >= since
  ),
  td as (select d.*, d.day - epoch as dn from public.telemetry_daily d where d.user_id <> me and d.day >= since),
  -- Veces de cada evento y de cada interfaz por estudiante y día: lo suelto
  -- (últimos 14 días) más lo compactado.
  evd as (
    select user_id, dn, event, count(*) as n from te group by user_id, dn, event
    union all
    select c.user_id, c.dn, k.key, k.value::bigint from tc c cross join lateral jsonb_each(c.ev) k
  ),
  scd as (
    select user_id, dn, props ->> 'screen' as screen, count(*) as n from te
     where event = 'screen_view' and props ->> 'screen' is not null
     group by user_id, dn, props ->> 'screen'
    union all
    select c.user_id, c.dn, k.key, k.value::bigint from tc c cross join lateral jsonb_each(c.sc) k
  ),
  active as (
    select user_id, dn from evd
    union select user_id, dn from td
    union select user_id, (last_seen at time zone tz)::date - epoch from tu where last_seen >= since_ts
  ),
  opens as (
    -- Cuándo se abre Frame, en la hora LOCAL de cada estudiante (lun = 0).
    select ((extract(isodow from te.created_at at time zone coalesce(u.timezone, tz))::int - 1) * 24
            + extract(hour from te.created_at at time zone coalesce(u.timezone, tz))::int) as slot
      from te left join tu u on u.user_id = te.user_id
     where te.event = 'app_open'
    union all
    select unnest(c.opens)::int from tc c
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
      from (select user_id, event, sum(n)::bigint as n from evd group by user_id, event) x group by user_id
  ),
  screens_by as (
    select user_id, jsonb_object_agg(screen, n) as sc
      from (select user_id, screen, sum(n)::bigint as n from scd group by user_id, screen) x group by user_id
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
                from (select event, dn, sum(n)::bigint as n, count(distinct user_id) as users
                        from evd group by event, dn) per_day
               group by event) x
    ),
    'sc', (
      select coalesce(jsonb_object_agg(x.screen, x.days), '{}'::jsonb)
        from (select screen, jsonb_agg(jsonb_build_array(dn, n, users) order by dn) as days
                from (select screen, dn, sum(n)::bigint as n, count(distinct user_id) as users
                        from scd group by screen, dn) per_day
               group by screen) x
    ),
    'reports', (
      select coalesce(jsonb_object_agg(x.fmt, x.n), '{}'::jsonb)
        from (select fmt, sum(n)::bigint as n
                from (select coalesce(props ->> 'format', '?') as fmt, count(*) as n from te
                       where event = 'report_generated' group by coalesce(props ->> 'format', '?')
                      union all
                      select k.key, k.value::bigint from tc c cross join lateral jsonb_each(c.rep) k) r
               group by fmt) x
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

-- A quién apartar de las cifras cuando la foto se recalcula sola (no hay
-- sesión en pg_cron): lo deja el propio responsable al abrir las métricas.
alter table public.usage_snapshots add column if not exists owner_id text;

drop function if exists public.usage_snapshot(integer, boolean);
create or replace function public.usage_snapshot(max_age_hours integer default 6, force boolean default false, known timestamptz default null)
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
    if snap.owner_id is distinct from me then
      update public.usage_snapshots set owner_id = me where id = 1;
    end if;
    -- La página ya tiene esta misma foto: no se vuelve a descargar entera.
    if known is not null and known >= snap.generated_at then
      return jsonb_build_object('v', 1, 'same', true);
    end if;
    return snap.data;
  end if;
  fresh := private.build_usage_snapshot(me);
  insert into public.usage_snapshots (id, generated_at, data, owner_id) values (1, now(), fresh, me)
    on conflict (id) do update set generated_at = excluded.generated_at, data = excluded.data, owner_id = excluded.owner_id;
  return fresh;
end;
$$;
revoke all on function public.usage_snapshot(integer, boolean, timestamptz) from public, anon;
grant execute on function public.usage_snapshot(integer, boolean, timestamptz) to authenticated;

create or replace function private.refresh_usage_snapshot()
returns void
language plpgsql
security definer
set search_path to ''
as $$
declare
  owner text;
begin
  select owner_id into owner from public.usage_snapshots where id = 1;
  if owner is null then
    return; -- nadie ha abierto las métricas todavía: no hay a quién apartar
  end if;
  update public.usage_snapshots set generated_at = now(), data = private.build_usage_snapshot(owner) where id = 1;
end;
$$;
revoke all on function private.refresh_usage_snapshot() from public, anon, authenticated;

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
                  left join (select s.slot, count(*) as n
                               from (select ((extract(isodow from e.created_at at time zone coalesce(u.timezone, tz))::int - 1) * 24
                                             + extract(hour from e.created_at at time zone coalesce(u.timezone, tz))::int) as slot
                                       from public.telemetry_events e
                                      where e.user_id = u.user_id and e.event = 'app_open'
                                     union all
                                     select unnest(c.opens)::int from private.telemetry_event_days c
                                      where c.user_id = u.user_id) s
                              group by s.slot) o on o.slot = g.slot),
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
-- 4. Fuera lo del panel viejo (ninguna versión vigente lo llama)
-- ------------------------------------------------------------
drop function if exists public.usage_overview(integer);
drop function if exists public.guest_overview(integer);

-- ------------------------------------------------------------
-- 5. Eliminar la cuenta
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

  delete from public.backups               where user_id = uid;
  delete from public.telemetry_events      where user_id = uid::text;
  delete from private.telemetry_event_days where user_id = uid::text;
  delete from public.telemetry_daily       where user_id = uid::text;
  delete from public.telemetry_weekly      where user_id = uid::text;
  delete from public.telemetry_users       where user_id = uid::text;
  update public.error_log set user_ids = array_remove(user_ids, uid::text) where uid::text = any (user_ids);
  delete from public.profiles              where id      = uid;
  -- La foto del panel la lleva dentro: se vacía y se recalcula sin ella.
  update public.usage_snapshots set generated_at = '-infinity', data = '{}'::jsonb;

  -- Debe ir al final: borrar la identidad invalida el JWT en curso.
  delete from auth.users                   where id      = uid;
end;
$function$;

-- ------------------------------------------------------------
-- 6. Las tareas de cada día (pg_cron, hora UTC)
-- ------------------------------------------------------------
create extension if not exists pg_cron with schema pg_catalog;

-- 04:10 de Perú: compactar lo de hace más de 14 días y borrar lo de más de 12 meses.
select cron.schedule('frame-telemetria-diaria', '10 9 * * *',
  $cron$select private.compact_telemetry(14); select private.prune_diagnostics();$cron$);
-- Cada 6 h: la foto del panel, lista antes de que el responsable la pida.
select cron.schedule('frame-foto-de-uso', '25 */6 * * *', $cron$select private.refresh_usage_snapshot();$cron$);
