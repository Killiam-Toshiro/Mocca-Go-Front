/** Periodos de las métricas: días de Colombia en `AAAA-MM-DD`, sin pasar por UTC (D-129). */
export const MAX_PERIOD_DAYS = 366;
export const DEFAULT_PRESET = '30d';

export type PresetId = '7d' | '30d' | '90d' | 'mes';
export const PRESETS: readonly { id: PresetId; label: string }[] = [
  { id: '7d', label: '7 días' },
  { id: '30d', label: '30 días' },
  { id: '90d', label: '90 días' },
  { id: 'mes', label: 'Este mes' },
];

const DAY_MS = 86_400_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** `true` si es una fecha real del calendario (rechaza `2026-02-31`). */
export function isIsoDay(value: string | null | undefined): value is string {
  if (!value || !ISO_DAY.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

/** Hoy en Colombia (UTC−5), sin importar la zona del navegador. */
export function todayBogota(now: Date = new Date()): string {
  return new Date(now.getTime() - 5 * 3_600_000).toISOString().slice(0, 10);
}

export function addDays(day: string, delta: number): string {
  return new Date(Date.parse(`${day}T00:00:00Z`) + delta * DAY_MS)
    .toISOString()
    .slice(0, 10);
}

/** Días del periodo, contando ambos extremos. */
export function daysBetween(from: string, to: string): number {
  return (
    Math.round(
      (Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) /
        DAY_MS,
    ) + 1
  );
}

export interface Period {
  from: string;
  to: string;
}

export function presetRange(id: PresetId, today: string): Period {
  if (id === 'mes') return { from: `${today.slice(0, 8)}01`, to: today };
  const days = id === '7d' ? 7 : id === '90d' ? 90 : 30;
  return { from: addDays(today, -(days - 1)), to: today };
}

/** El atajo que coincide con el periodo, o `null` si es personalizado. */
export function activePreset(period: Period, today: string): PresetId | null {
  return (
    PRESETS.find((p) => {
      const r = presetRange(p.id, today);
      return r.from === period.from && r.to === period.to;
    })?.id ?? null
  );
}

/** Mensaje en español si el periodo no se puede consultar; `null` si es válido. */
export function validatePeriod(from: string, to: string): string | null {
  if (!isIsoDay(from) || !isIsoDay(to)) return 'Elige las dos fechas.';
  if (from > to) return 'La fecha inicial no puede ser posterior a la final.';
  if (daysBetween(from, to) > MAX_PERIOD_DAYS)
    return `El periodo no puede superar ${String(MAX_PERIOD_DAYS)} días.`;
  return null;
}

export interface MetricsFilters extends Period {
  zoneId: string | null;
  /** Problema del periodo escrito en la URL (no se consulta al back). */
  error: string | null;
}

interface ParamsLike {
  get(name: string): string | null;
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Lee `?from=&to=&zoneId=`; sin fechas válidas usa los últimos 30 días. */
export function parseMetricsFilters(
  params: ParamsLike,
  today: string,
): MetricsFilters {
  const rawFrom = params.get('from');
  const rawTo = params.get('to');
  const zone = params.get('zoneId');
  const zoneId = zone && UUID.test(zone) ? zone : null;
  if (!isIsoDay(rawFrom) || !isIsoDay(rawTo)) {
    return { ...presetRange(DEFAULT_PRESET, today), zoneId, error: null };
  }
  return {
    from: rawFrom,
    to: rawTo,
    zoneId,
    error: validatePeriod(rawFrom, rawTo),
  };
}

export function metricsQuery(filters: Period & { zoneId: string | null }) {
  const q = new URLSearchParams({ from: filters.from, to: filters.to });
  if (filters.zoneId) q.set('zoneId', filters.zoneId);
  return q;
}
