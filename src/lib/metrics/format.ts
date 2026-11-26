export const NO_DATA = 'Sin datos';

const MONTHS = [
  'ene',
  'feb',
  'mar',
  'abr',
  'may',
  'jun',
  'jul',
  'ago',
  'sep',
  'oct',
  'nov',
  'dic',
];

function decimal(n: number, digits: number): string {
  return n.toFixed(digits).replace('.', ',');
}

/** Proporción 0–1 → `91 %` (un decimal solo si hace falta); `null` → «Sin datos», nunca 0 %. */
export function formatPercent(ratio: number | null | undefined): string {
  if (ratio === null || ratio === undefined) return NO_DATA;
  const pct = Math.round(ratio * 1000) / 10;
  return `${Number.isInteger(pct) ? String(pct) : decimal(pct, 1)} %`;
}

/** Minutos con un decimal: `21,4 min`; `null` → «Sin datos». */
export function formatMinutes(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return NO_DATA;
  return `${decimal(minutes, 1)} min`;
}

/** Promedio de calificación con un decimal: `4,4`; `null` → «Sin datos». */
export function formatRating(value: number | null | undefined): string {
  if (value === null || value === undefined) return NO_DATA;
  return decimal(value, 1);
}

/** `2026-11-05` → `5 nov` (sin pasar por `Date`, para no correr el día por la zona horaria). */
export function formatDay(day: string): string {
  const [, m, d] = day.split('-');
  return `${String(Number(d))} ${MONTHS[Number(m) - 1] ?? ''}`.trim();
}

/** `2026-11-05` → `5 nov 2026`. */
export function formatDayLong(day: string): string {
  return `${formatDay(day)} ${day.slice(0, 4)}`;
}

export function formatCount(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

/** Hora de Colombia de la última consulta: `2:05 p. m.`. */
export function formatClock(ms: number): string {
  return new Intl.DateTimeFormat('es-CO', {
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'America/Bogota',
  }).format(new Date(ms));
}
