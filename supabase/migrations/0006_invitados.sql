-- ============================================================
-- 0006 · Invitados en el panel de uso (Frame 1.5.3 / Android 1.0.6)
--
-- «Entrar como invitado» vuelve a la pantalla de acceso para quitar la
-- fricción del primer uso. La app registra dos eventos seudónimos en
-- telemetry_events (que ya admite escrituras de anon):
--   · guest_started {resumed}            → alguien entró como invitado
--   · guest_linked  {days_as_guest, …}   → un invitado vinculó su Google
-- Esta función los resume para el panel «Uso». Como usage_overview, solo
-- responde al responsable de Frame (is_frame_owner). No toca nada existente.
-- ============================================================

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
begin
  if not public.is_frame_owner() then
    raise exception 'Solo el responsable de Frame puede consultar el panel de uso'
      using errcode = '42501';
  end if;

  return jsonb_build_object(
    'started_period', (select count(distinct user_id) from public.telemetry_events
                        where event = 'guest_started' and created_at >= since_ts),
    'started_today',  (select count(distinct user_id) from public.telemetry_events
                        where event = 'guest_started' and (created_at at time zone 'America/Lima')::date = today),
    'resumed_period', (select count(*) from public.telemetry_events
                        where event = 'guest_started' and created_at >= since_ts
                          and coalesce((props ->> 'resumed')::boolean, false)),
    'linked_period',  (select count(distinct user_id) from public.telemetry_events
                        where event = 'guest_linked' and created_at >= since_ts),
    'linked_today',   (select count(distinct user_id) from public.telemetry_events
                        where event = 'guest_linked' and (created_at at time zone 'America/Lima')::date = today),
    'guests_total',   (select count(*) from public.telemetry_users where is_guest),
    'guests_active_7d', (select count(distinct e.user_id)
                           from public.telemetry_events e
                           join public.telemetry_users u on u.user_id = e.user_id
                          where u.is_guest and e.created_at >= now() - interval '7 days'),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object(
                'date', ds.d,
                'started', (select count(distinct user_id) from public.telemetry_events
                             where event = 'guest_started' and (created_at at time zone 'America/Lima')::date = ds.d),
                'linked',  (select count(distinct user_id) from public.telemetry_events
                             where event = 'guest_linked' and (created_at at time zone 'America/Lima')::date = ds.d)
              ) order by ds.d), '[]'::jsonb)
                from (select generate_series(since, today, interval '1 day')::date as d) ds)
  );
end;
$function$;

revoke all on function public.guest_overview(integer) from public;
revoke all on function public.guest_overview(integer) from anon;
grant execute on function public.guest_overview(integer) to authenticated;
