// Clientes REST mínimos para las integraciones Google de Frame.
// Cada llamada usa el token de la cuenta vinculada a SU integración
// (multi-cuenta: Classroom puede ir con la institucional y Gmail con la
// personal), con refresh automático. Cachean la última respuesta para offline.
import { getAccessToken, profileSuffix, type IntegrationKey } from './auth';
import { tr } from '@/lib/i18n';

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
    throw new Error(body?.error?.message ?? tr('Error de Google ({status})', { status: resp.status }));
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
        subject: header('Subject') || tr('(sin asunto)'),
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
