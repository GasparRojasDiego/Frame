import type { StudySession } from '@/types';

// ============================================================
// ¿En qué momento del día se estudió? Mañana, tarde y noche.
//
// Antes vivía en la tarjeta «Dónde fue tu tiempo» de Inicio; ahora lo usa el
// calendario de Enfoque al abrir un día. El instante de cada sesión se toma
// de su PUNTO MEDIO: una sesión que cruza de la tarde a la noche se imputa
// donde de verdad pesó.
// ============================================================

interface DaypartBucket {
  key: 'manana' | 'tarde' | 'noche';
  label: string;
  hint: string;
  minutes: number;
}

interface DaypartSummary {
  buckets: DaypartBucket[];
  total: number;
  sessions: number;
  top: DaypartBucket;
}

/** Reparto por franjas de las sesiones cuyo punto medio cae entre `from` y `to` (ms). */
export function studyDayparts(sessions: StudySession[], from: number, to: number): DaypartSummary | null {
  const buckets: DaypartBucket[] = [
    { key: 'manana', label: 'Mañana', hint: '5–12 h', minutes: 0 },
    { key: 'tarde', label: 'Tarde', hint: '12–19 h', minutes: 0 },
    { key: 'noche', label: 'Noche', hint: '19–5 h', minutes: 0 },
  ];
  let total = 0;
  let count = 0;

  for (const session of sessions) {
    const seconds = session.durationSec ?? session.duration * 60;
    if (!Number.isFinite(seconds) || seconds <= 0) continue;
    // startTime y endTime guardan el instante de REGISTRO; el tramo real se
    // deduce restando la duración, y de ahí sale el punto medio.
    const endMs = Date.parse(session.endTime) || Date.parse(session.startTime);
    if (!Number.isFinite(endMs)) continue;
    const middle = endMs - (seconds * 1000) / 2;
    if (middle < from || middle >= to) continue;
    const hour = new Date(middle).getHours();
    const index = hour >= 5 && hour < 12 ? 0 : hour >= 12 && hour < 19 ? 1 : 2;
    buckets[index].minutes += seconds / 60;
    total += seconds / 60;
    count += 1;
  }

  if (total === 0) return null;
  const top = [...buckets].sort((a, b) => b.minutes - a.minutes)[0];
  return { buckets, total, sessions: count, top };
}
