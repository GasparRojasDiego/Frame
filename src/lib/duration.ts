// ============================================================
// Formateo de duraciones de estudio. La fuente de verdad de una sesión
// es `durationSec` (segundos exactos); `duration` son esos mismos
// segundos expresados en minutos con decimales.
// ============================================================

/** Segundos exactos de una sesión, tolerando datos antiguos (solo minutos). */
export function sessionSeconds(s: { durationSec?: number; duration: number }): number {
  if (typeof s.durationSec === 'number' && Number.isFinite(s.durationSec)) {
    return Math.max(0, Math.round(s.durationSec));
  }
  return Math.max(0, Math.round((s.duration || 0) * 60));
}

/** "01:23:45" si hay horas, "23:45" si no. */
export function formatHMS(totalSeconds: number): string {
  const t = Math.max(0, Math.round(totalSeconds || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${String(h).padStart(2, '0')}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** "1h 05m 30s" · "5m 30s" · "42s" (etiquetas legibles en español). */
export function formatDurationLabel(totalSeconds: number): string {
  const t = Math.max(0, Math.round(totalSeconds || 0));
  const h = Math.floor(t / 3600);
  const m = Math.floor((t % 3600) / 60);
  const s = t % 60;
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
  if (m > 0) return `${m}m ${String(s).padStart(2, '0')}s`;
  return `${s}s`;
}

/** "Xh Ym" a partir de MINUTOS. null si es 0 (para omitir la etiqueta).
 *  Las horas justas se escriben "2h", no "2h 0m": el cero no aporta nada. */
export function formatTotalMinutes(totalMinutes: number): string | null {
  // Menos de un minuto se omite, igual que cero: "0m" no informa de nada.
  if (!Number.isFinite(totalMinutes) || totalMinutes < 1) return null;
  const h = Math.floor(totalMinutes / 60);
  const m = Math.floor(totalMinutes % 60);
  if (h === 0) return `${m}m`;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}

/** Igual que `formatTotalMinutes` pero nunca devuelve null: "0m" si no hay tiempo. */
export function formatMinutes(totalMinutes: number): string {
  return formatTotalMinutes(totalMinutes) ?? '0m';
}
