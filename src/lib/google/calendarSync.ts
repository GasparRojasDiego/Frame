// ============================================================
// Sincronización bidireccional Frame ⇄ Google Calendar.
//
// Frame → Google: cada tarea con fecha límite se refleja como un evento en
// el calendario principal (crear/editar/completar/eliminar la tarea crea,
// actualiza o borra su evento). El vínculo tarea→evento se guarda en
// localStorage y el evento lleva la marca privada frameTaskId.
//
// Google → Frame: los eventos creados en Google Calendar aparecen en la
// interfaz Calendario de la app (webview incrustado en vivo + caché de la
// API para el modo sin conexión).
// ============================================================
import type { Task } from '@/types';
import { hasScopes } from './auth';
import {
  insertCalendarEvent,
  patchCalendarEvent,
  deleteCalendarEvent,
  type CalendarEventInput,
} from './api';
import { isTauri } from '@tauri-apps/api/core';

/** Clave heredada: un único mapa para toda la máquina. */
const LEGACY_MAP_KEY = 'gcalTaskSync';
/**
 * El mapa tarea→evento es POR PERFIL. Siendo global, al entrar con otro perfil
 * ninguna de "sus" tareas coincidía con las del mapa, el reconciliador las daba
 * por eliminadas y BORRABA de Google Calendar los eventos del otro perfil.
 */
const mapKey = (uid: string) => `gcalTaskSync_${uid}`;

interface SyncEntry {
  eventId: string;
  /** firma del último estado sincronizado (evita PATCH innecesarios) */
  sig: string;
}

type SyncMap = Record<string, SyncEntry>;

function readMap(key: string): SyncMap | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as SyncMap) : null;
  } catch {
    return null;
  }
}

function loadMap(uid: string, tasks: Task[]): SyncMap {
  const own = readMap(mapKey(uid));
  if (own) return own;

  // Migración del mapa global: solo lo hereda el perfil al que pertenece, es
  // decir, aquel cuyas tareas aparecen en él. Si no coincide ninguna, el mapa
  // es de otro perfil y se deja donde está.
  const legacy = readMap(LEGACY_MAP_KEY);
  if (legacy && tasks.some((t) => legacy[t.id])) {
    try {
      localStorage.setItem(mapKey(uid), JSON.stringify(legacy));
      localStorage.removeItem(LEGACY_MAP_KEY);
    } catch {
      /* sin espacio: se usa en memoria y se reintenta otro día */
    }
    return legacy;
  }
  return {};
}

function saveMap(uid: string, map: SyncMap) {
  try {
    localStorage.setItem(mapKey(uid), JSON.stringify(map));
  } catch {
    /* sin espacio: el próximo ciclo recalcula */
  }
}

/**
 * ¿Es de fiar una lista de tareas VACÍA? Si la clave de tareas del perfil está
 * corrupta, el proveedor entrega `[]` — y borrar todos los eventos de Google
 * porque un JSON no se pudo leer sería imperdonable.
 */
function emptyIsTrustworthy(uid: string): boolean {
  try {
    const raw = localStorage.getItem(`tasks_${uid}`);
    if (raw === null) return true;
    return Array.isArray(JSON.parse(raw));
  } catch {
    return false;
  }
}

function taskSignature(t: Task): string {
  // El avance entra por DECENAS: el evento enseña «Avance: X%» y sin esto se
  // quedaba con el de la primera sincronización; al 1 % sería un PATCH por
  // cada sesión de estudio.
  const progress = t.progress >= 100 ? 'done' : `open${Math.floor((t.progress || 0) / 10)}`;
  return [t.name, t.dueDate, t.courseName, t.priority, progress].join('|');
}

function taskToEvent(t: Task): CalendarEventInput {
  const done = t.progress >= 100;
  const start = new Date(t.dueDate!);
  const end = new Date(start.getTime() + 60 * 60 * 1000);
  return {
    summary: `${done ? '✅' : '📚'} ${t.name}`,
    description: [
      `Tarea de ${t.courseName}`,
      `Prioridad: ${t.priority}`,
      done ? 'Completada' : `Avance: ${t.progress}%`,
      '',
      'Sincronizada desde Frame',
    ].join('\n'),
    startISO: start.toISOString(),
    endISO: end.toISOString(),
    frameTaskId: t.id,
  };
}

const isGone = (e: unknown) => /\(4(04|10)\)|not ?found|deleted/i.test(String((e as any)?.message ?? e));

let syncing = false;
/** Petición que llegó mientras se sincronizaba: se atiende al terminar. */
let queued: { tasks: Task[]; uid: string } | null = null;

/**
 * Reconcilia las tareas de Frame con Google Calendar. Idempotente y barata:
 * solo toca la red cuando algo cambió respecto a la última firma.
 */
export async function syncTasksToCalendar(tasks: Task[], uid: string | null | undefined): Promise<void> {
  if (!uid) return;
  if (syncing) {
    // Descartarla (como se hacía) dejaba el cambio sin subir hasta el repaso
    // de los 15 minutos. Se guarda la ÚLTIMA y se ejecuta al acabar esta.
    queued = { tasks, uid };
    return;
  }
  if (!isTauri() || !navigator.onLine || !hasScopes('calendar')) return;
  syncing = true;
  try {
    const map = loadMap(uid, tasks);
    let dirty = false;
    const withDue = tasks.filter((t) => t.dueDate);

    for (const t of withDue) {
      const sig = taskSignature(t);
      const entry = map[t.id];
      try {
        if (!entry) {
          const created = await insertCalendarEvent(taskToEvent(t));
          map[t.id] = { eventId: created.id, sig };
          dirty = true;
        } else if (entry.sig !== sig) {
          try {
            await patchCalendarEvent(entry.eventId, taskToEvent(t));
          } catch (e) {
            if (!isGone(e)) throw e;
            // El evento fue borrado en Google: la tarea sigue viva → recrearlo.
            const created = await insertCalendarEvent(taskToEvent(t));
            entry.eventId = created.id;
          }
          entry.sig = sig;
          dirty = true;
        }
      } catch {
        /* una tarea fallida no debe frenar el resto; se reintenta en el próximo ciclo */
      }
    }

    // Tareas eliminadas (o que perdieron su fecha) → borrar su evento.
    // …salvo que la lista venga vacía por un fallo de lectura y no porque el
    // estudiante haya borrado todas sus tareas.
    const alive = new Set(withDue.map((t) => t.id));
    const canDelete = tasks.length > 0 || emptyIsTrustworthy(uid);
    for (const taskId of canDelete ? Object.keys(map) : []) {
      if (alive.has(taskId)) continue;
      try {
        await deleteCalendarEvent(map[taskId].eventId);
      } catch (e) {
        if (!isGone(e)) continue; // error transitorio: reintentar en el próximo ciclo
      }
      delete map[taskId];
      dirty = true;
    }

    if (dirty) saveMap(uid, map);
  } finally {
    syncing = false;
    if (queued) {
      const next = queued;
      queued = null;
      void syncTasksToCalendar(next.tasks, next.uid);
    }
  }
}
