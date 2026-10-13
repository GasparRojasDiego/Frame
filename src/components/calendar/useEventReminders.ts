import { useEffect, useRef } from 'react';
import { notify } from '@/lib/notify';
import type { LocalCalendarEvent } from '@/types';
import { richNoteToLine } from '@/lib/rich-note';
import { normalizeKind } from '@/lib/calendar-events';
import { addDays, eventEnd, rangeLabel, shortDayLabel, toKey } from './calendar-model';
import { tr } from '@/lib/i18n';

// ============================================================
// Avisos de los eventos del calendario LOCAL.
//
// Un evento con hora y `remindBefore` avisa con la notificación nativa de
// Frame (con su sonido), también con la ventana oculta en la bandeja. En un
// rango de días avisa cada día a esa hora: «tomar la pastilla del 1 al 7».
//
// Vive junto al estado (CourseContext), no en la interfaz Calendario: el aviso
// tiene que llegar estés donde estés dentro de la app.
//
// Cada aviso se da UNA vez por día y evento; si después se cambia la hora o
// la antelación de modo que el aviso cae más tarde, se vuelve a dar a la nueva
// hora. Si Frame estaba cerrado a la hora del aviso, al abrirlo se da el
// pendiente mientras el evento no haya pasado (con un margen de 15 minutos);
// uno ya pasado no se da tarde.
//
// 1.6.8 (Diego): el recordatorio es el mismo que el de una tarea (días de la
// semana, hora y repetición, ver ReminderEditor). Avisa desde hoy hasta que
// pasa el evento; un «Recordatorio» (el tipo), solo dentro de sus días. El
// día se parte en tramos como en las tareas: un aviso por tramo, así que abrir
// Frame tarde da el pendiente una sola vez y no una ráfaga. El aviso antiguo
// (`remindBefore`) sigue valiendo en los eventos que aún lo traen.
// ============================================================

const GRACE_MS = 15 * 60_000;

const clock = (date: Date) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

function whenText(at: Date, now: Date): string {
  const minutes = Math.round((at.getTime() - now.getTime()) / 60_000);
  if (minutes <= 1) return tr('Ahora · {clock}', { clock: clock(at) });
  if (minutes < 60) return tr('En {minutes} min · a las {clock}', { minutes, clock: clock(at) });
  if (toKey(at) === toKey(now)) return tr('Hoy a las {clock}', { clock: clock(at) });
  return tr('Mañana a las {clock}', { clock: clock(at) });
}

/** Cuándo es el evento, visto desde el día de hoy (para el recordatorio). */
function eventWhen(event: LocalCalendarEvent, today: string): string {
  const last = eventEnd(event);
  if (last !== event.date) return tr('Del {rangeLabel}', { rangeLabel: rangeLabel({ start: event.date, end: last }) });
  const day =
    event.date === today ? tr('Hoy') : event.date === addDays(today, 1) ? tr('Mañana') : shortDayLabel(event.date);
  return event.time ? tr('{day} a las {time}', { day, time: event.time }) : day;
}

/** `scope`: sufijo único del usuario (la clave de sus eventos); null = sin sesión. */
export function useLocalEventReminders(events: LocalCalendarEvent[], scope: string | null) {
  // Espejo: el temporizador se arma una vez por usuario y lee siempre lo último.
  const eventsRef = useRef(events);
  eventsRef.current = events;

  useEffect(() => {
    if (!scope) return;
    const sentKey = `localEventReminderSent_${scope}`;
    // Copia en memoria de las marcas dadas en esta sesión: con localStorage
    // lleno o inaccesible, un aviso no se repetiría cada 30 s.
    const memo: Record<string, number> = {};

    const readSent = (): Record<string, number> => {
      try {
        const raw = window.localStorage.getItem(sentKey);
        const parsed = raw ? JSON.parse(raw) : {};
        return parsed && typeof parsed === 'object' ? parsed : {};
      } catch {
        return {};
      }
    };

    const check = () => {
      const armed = eventsRef.current.filter(
        (event) =>
          !!event.time && !event.reminderEnabled && typeof event.remindBefore === 'number' && event.remindBefore >= 0
      );
      const reminded = eventsRef.current.filter((event) => event.reminderEnabled === true && !!event.reminderTime);
      if (armed.length === 0 && reminded.length === 0) return;

      const now = new Date();
      const today = toKey(now);
      const sent = { ...readSent(), ...memo };
      let changed = false;

      // --- Recordatorio como el de las tareas (1.6.8) ---
      for (const event of reminded) {
        const last = eventEnd(event);
        const first = normalizeKind(event.kind) === 'recordatorio' ? event.date : today;
        if (today < first || today > last) continue;
        const days = event.reminderDays ?? [];
        if (days.length > 0 && !days.includes(now.getDay())) continue;
        const [h, m] = (event.reminderTime ?? '').split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
        const start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m).getTime();
        if (now.getTime() < start) continue;
        // El último día, un recordatorio que cae después de la hora del evento ya no sirve.
        if (today === last && event.time) {
          const [eh, em] = event.time.split(':').map(Number);
          if (Number.isFinite(eh) && Number.isFinite(em) && start > new Date(now.getFullYear(), now.getMonth(), now.getDate(), eh, em).getTime()) continue;
        }
        const repeat = Math.max(0, event.reminderRepeatMinutes ?? 0);
        const slot = repeat > 0 ? Math.floor((now.getTime() - start) / (repeat * 60_000)) : 0;
        const mark = `r#${event.id}#${today}#${slot}`;
        if (sent[mark]) continue;
        const note = event.description ? richNoteToLine(event.description) : '';
        void notify({
          text: () => ({ title: event.title, body: `${eventWhen(event, today)}${note ? ` — ${note}` : ''}` }),
          kind: 'recordatorio',
          route: '/calendario',
        });
        sent[mark] = memo[mark] = Date.now();
        changed = true;
      }

      for (const event of armed) {
        const [h, m] = (event.time ?? '').split(':').map(Number);
        if (!Number.isFinite(h) || !Number.isFinite(m)) continue;
        const last = eventEnd(event);
        // Hoy y mañana bastan: el aviso más adelantado es «el día antes».
        for (const day of [today, addDays(today, 1)]) {
          if (day < event.date || day > last) continue;
          const [y, mo, d] = day.split('-').map(Number);
          const at = new Date(y, mo - 1, d, h, m);
          const fireAt = at.getTime() - (event.remindBefore ?? 0) * 60_000;
          if (now.getTime() < fireAt || now.getTime() > at.getTime() + GRACE_MS) continue;
          // La marca guarda cuándo se dio el aviso, y solo cuenta si fue a partir
          // de la hora de aviso actual: si luego se movió el evento o se acortó
          // la antelación, el aviso cae más tarde y se vuelve a dar.
          const mark = `${event.id}#${day}`;
          if (sent[mark] && sent[mark] >= fireAt) continue;

          const note = event.description ? richNoteToLine(event.description) : '';
          void notify({
            text: () => ({ title: event.title, body: `${whenText(at, now)}${note ? ` — ${note}` : ''}` }),
            kind: 'recordatorio',
            route: '/calendario',
          });
          sent[mark] = memo[mark] = Date.now();
          changed = true;
        }
      }

      if (changed) {
        // De paso se olvidan las marcas de hace más de dos días.
        const horizon = Date.now() - 2 * 86_400_000;
        for (const [mark, at] of Object.entries(sent)) {
          if (at < horizon) {
            delete sent[mark];
            delete memo[mark];
          }
        }
        try {
          window.localStorage.setItem(sentKey, JSON.stringify(sent));
        } catch {
          /* sin almacenamiento: la copia en memoria evita repetirlo en esta sesión */
        }
      }
    };

    const initial = setTimeout(check, 8_000);
    const interval = setInterval(check, 30_000);
    return () => {
      clearTimeout(initial);
      clearInterval(interval);
    };
  }, [scope]);
}
