// Clientes REST mínimos para las integraciones Google de Frame.
// Cada llamada usa el token de la cuenta vinculada a SU integración
// (multi-cuenta: Classroom puede ir con la institucional y Gmail con la
// personal), con refresh automático. Cachean la última respuesta para offline.
import { getAccessToken, profileSuffix, type IntegrationKey } from './auth';

async function gfetch<T>(integration: IntegrationKey, url: string, init?: RequestInit): Promise<T> {
  const token = await getAccessToken(integration);
  const resp = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  if (!resp.ok) {
    const body = await resp.json().catch(() => null);
    throw new Error(body?.error?.message ?? `Error de Google (${resp.status})`);
  }
  if (resp.status === 204) return undefined as T;
  return resp.json() as Promise<T>;
}

function cacheSet(key: string, value: unknown) {
  try {
    localStorage.setItem(key + profileSuffix(), JSON.stringify({ at: Date.now(), value }));
  } catch { /* cuota llena: la caché es prescindible */ }
}

export function cacheGet<T>(key: string): { at: number; value: T } | null {
  try {
    const raw = localStorage.getItem(key + profileSuffix());
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ---------------- Google Calendar ----------------

export interface CalendarEvent {
  id: string;
  summary: string;
  /** ISO — fecha/hora de inicio (all-day usa fecha pura) */
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  htmlLink?: string;
  calendarColor?: string;
}

export async function listCalendarEvents(timeMinISO: string, timeMaxISO: string): Promise<CalendarEvent[]> {
  const params = new URLSearchParams({
    timeMin: timeMinISO,
    timeMax: timeMaxISO,
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '250',
  });
  const data = await gfetch<any>(
    'calendar',
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`
  );
  const events: CalendarEvent[] = (data.items ?? [])
    .filter((e: any) => e.status !== 'cancelled')
    .map((e: any) => ({
      id: e.id,
      summary: e.summary ?? '(sin título)',
      start: e.start?.dateTime ?? e.start?.date ?? '',
      end: e.end?.dateTime ?? e.end?.date ?? '',
      allDay: !e.start?.dateTime,
      location: e.location,
      htmlLink: e.htmlLink,
    }));
  cacheSet(`gcal_${timeMinISO.slice(0, 7)}`, events);
  return events;
}

// --- Escritura de eventos (sincronización de tareas Frame → Calendar) ---

export interface CalendarEventInput {
  summary: string;
  description?: string;
  startISO: string;
  endISO: string;
  /** marca privada para reconocer los eventos creados por Frame */
  frameTaskId: string;
}

function eventBody(input: CalendarEventInput) {
  return {
    summary: input.summary,
    description: input.description,
    start: { dateTime: input.startISO },
    end: { dateTime: input.endISO },
    extendedProperties: { private: { frameTaskId: input.frameTaskId } },
  };
}

export async function insertCalendarEvent(input: CalendarEventInput): Promise<{ id: string }> {
  return gfetch<{ id: string }>(
    'calendar',
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    { method: 'POST', body: JSON.stringify(eventBody(input)) }
  );
}

export async function patchCalendarEvent(eventId: string, input: CalendarEventInput): Promise<void> {
  await gfetch<any>(
    'calendar',
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    { method: 'PATCH', body: JSON.stringify(eventBody(input)) }
  );
}

export async function deleteCalendarEvent(eventId: string): Promise<void> {
  await gfetch<any>(
    'calendar',
    `https://www.googleapis.com/calendar/v3/calendars/primary/events/${encodeURIComponent(eventId)}`,
    { method: 'DELETE' }
  );
}

// ---------------- Gmail ----------------

export interface GmailMessage {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  snippet: string;
  date: string; // ISO
  unread: boolean;
  starred: boolean;
}

const GMAIL_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me';

export async function listGmailMessages(maxResults = 25): Promise<GmailMessage[]> {
  const list = await gfetch<any>(
    'gmail',
    `${GMAIL_BASE}/messages?maxResults=${maxResults}&labelIds=INBOX`
  );
  const ids: { id: string; threadId: string }[] = list.messages ?? [];

  const messages = await Promise.all(
    ids.map(async ({ id }) => {
      const m = await gfetch<any>(
        'gmail',
        `${GMAIL_BASE}/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`
      );
      const header = (name: string) =>
        m.payload?.headers?.find((h: any) => h.name.toLowerCase() === name.toLowerCase())?.value ?? '';
      const fromRaw = header('From');
      return {
        id: m.id,
        threadId: m.threadId,
        from: fromRaw.replace(/<.*>/, '').replace(/"/g, '').trim() || fromRaw,
        subject: header('Subject') || '(sin asunto)',
        snippet: (m.snippet ?? '').replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, '&'),
        date: new Date(Number(m.internalDate)).toISOString(),
        unread: (m.labelIds ?? []).includes('UNREAD'),
        starred: (m.labelIds ?? []).includes('STARRED'),
      } as GmailMessage;
    })
  );
  cacheSet('gmail_inbox', messages);
  return messages;
}
