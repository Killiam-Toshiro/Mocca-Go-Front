import { randomUUID } from 'node:crypto';

/**
 * Métricas y encuestas del admin (008). Datos sembrados y determinísticos, relativos a «hoy»
 * en Colombia (UTC-5, sin horario de verano), con las reglas del back: pedidos creados en el
 * periodo, `daily` con ceros, `null` sin datos y tasas como proporción 0–1.
 */
export interface InsightsZone {
  id: string;
  name: string;
}
export interface InsightsResult {
  status: number;
  body: unknown;
}

const DAY = 86_400_000;
const BOGOTA = 5 * 3_600_000;
const ISO_DAY = /^\d{4}-\d{2}-\d{2}$/;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export const BAD_DATE = 'Las fechas deben tener el formato AAAA-MM-DD.';
export const BAD_RANGE = 'La fecha inicial no puede ser posterior a la final.';
export const TOO_LONG = 'El periodo no puede superar los 366 días.';
export const ZONE_MISSING = 'Zona no encontrada.';

const COST_RATE: Record<string, number> = {
  cafe: 0.3,
  bebida: 0.35,
  panaderia: 0.45,
  snack: 0.5,
};
const CATEGORIES = Object.keys(COST_RATE);
const NAMES = [
  'Ana Pérez',
  'Luis Gómez',
  'Marta Ruiz',
  'Juan Díaz',
  'Sara León',
  'Pablo Mora',
];
const COMMENTS = [
  'Llegó caliente y rápido',
  'Todo bien',
  null,
  'Faltó una servilleta\ny el café estaba tibio',
  null,
  '<b>Excelente</b> servicio',
];

type Outcome = 'entregado' | 'no_entregado' | 'cancelado' | 'enCurso';
interface Seed {
  id: string;
  number: number;
  day: string;
  createdAt: string;
  zoneId: string;
  customer: string;
  category: string;
  total: number;
  paid: boolean;
  outcome: Outcome;
  kitchen: number;
  waiting: number;
  delivery: number;
  rating: number | null;
  comment: string | null;
  surveyAt: string | null;
}

const dayOf = (ms: number): string =>
  new Date(ms - BOGOTA).toISOString().slice(0, 10);
const dayMs = (day: string): number => Date.parse(`${day}T00:00:00Z`);
const round1 = (n: number): number => Math.round(n * 10) / 10;
const rate = (n: number): number => Math.round(n * 1000) / 1000;
const isRealDay = (s: string): boolean => {
  if (!ISO_DAY.test(s)) return false;
  const ms = Date.parse(`${s}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === s;
};

function quantile(sorted: number[], q: number): number | null {
  if (sorted.length === 0) return null;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  const a = sorted[lo] ?? 0;
  const b = sorted[hi] ?? a;
  return round1(a + (b - a) * (pos - lo));
}
const mean = (v: number[]): number | null =>
  v.length === 0 ? null : round1(v.reduce((a, b) => a + b, 0) / v.length);

function timing(rows: Seed[]) {
  const total = rows
    .map((r) => r.kitchen + r.waiting + r.delivery)
    .sort((a, b) => a - b);
  const onTime = rows.filter((r) => r.delivery <= 15).length;
  return {
    delivered: rows.length,
    onTimeRate: rows.length === 0 ? null : rate(onTime / rows.length),
    totalMinutes: {
      average: mean(total),
      median: quantile(total, 0.5),
      p90: quantile(total, 0.9),
    },
    stageMinutes: {
      kitchen: mean(rows.map((r) => r.kitchen)),
      waiting: mean(rows.map((r) => r.waiting)),
      delivery: mean(rows.map((r) => r.delivery)),
    },
  };
}

export function createInsightsStore(zones: () => InsightsZone[]) {
  let seeds: Seed[] = [];

  function build(): Seed[] {
    const base = zones().slice(0, 2);
    if (base.length === 0) return [];
    const today = Date.now();
    const out: Seed[] = [];
    let n = 0;
    for (let d = 44; d >= 0; d--) {
      const midnight = dayMs(dayOf(today - d * DAY)) + BOGOTA;
      for (let k = 0; k < 3; k++) {
        const i = n++;
        const outcome: Outcome =
          d === 0 && k === 2
            ? 'enCurso'
            : i % 17 === 5
              ? 'cancelado'
              : i % 13 === 7
                ? 'no_entregado'
                : 'entregado';
        const delivered = outcome === 'entregado';
        const rating =
          delivered && i % 10 < 7 ? ([5, 4, 5, 3, 4, 2, 5][i % 7] ?? 5) : null;
        const created = midnight + (k + 1) * 3_600_000;
        out.push({
          id: randomUUID(),
          number: 1000 + i,
          day: dayOf(created),
          createdAt: new Date(created).toISOString(),
          zoneId: base[i % base.length]?.id ?? '',
          customer: NAMES[i % NAMES.length] ?? '',
          category: CATEGORIES[i % CATEGORIES.length] ?? 'cafe',
          total: 6000 + ((i * 1700) % 9000),
          paid: outcome !== 'cancelado',
          outcome,
          kitchen: 6 + (i % 5),
          waiting: 2 + (i % 4),
          delivery: 8 + ((i * 3) % 10),
          rating,
          comment:
            rating === null ? null : (COMMENTS[i % COMMENTS.length] ?? null),
          surveyAt:
            rating === null
              ? null
              : new Date(created + 2 * 3_600_000).toISOString(),
        });
      }
    }
    return out;
  }

  function range(
    query: URLSearchParams,
  ): InsightsResult | { from: string; to: string } {
    const today = dayOf(Date.now());
    const to = query.get('to') ?? today;
    const from = query.get('from') ?? dayOf(dayMs(to) + BOGOTA - 29 * DAY);
    if (!isRealDay(to) || !isRealDay(from)) return fail(400, BAD_DATE);
    if (from > to) return fail(400, BAD_RANGE);
    if ((dayMs(to) - dayMs(from)) / DAY + 1 > 366) return fail(400, TOO_LONG);
    return { from, to };
  }

  function metrics(query: URLSearchParams): InsightsResult {
    if (seeds.length === 0) seeds = build();
    const r = range(query);
    if ('status' in r) return r;
    const zoneId = query.get('zoneId');
    if (zoneId !== null) {
      if (!UUID_V4.test(zoneId))
        return fail(400, 'zoneId debe ser un UUID v4.');
      if (!zones().some((z) => z.id === zoneId)) return fail(404, ZONE_MISSING);
    }
    const rows = seeds.filter(
      (s) =>
        s.day >= r.from && s.day <= r.to && (!zoneId || s.zoneId === zoneId),
    );
    const paid = rows.filter((s) => s.paid);
    const revenue = paid.reduce((a, s) => a + s.total, 0);
    const days = (dayMs(r.to) - dayMs(r.from)) / DAY + 1;
    const daily = Array.from({ length: days }, (_, i) => {
      const date = dayOf(dayMs(r.from) + BOGOTA + i * DAY);
      const of = paid.filter((s) => s.day === date);
      return {
        date,
        orders: of.length,
        revenue: of.reduce((a, s) => a + s.total, 0),
      };
    });
    const cost = (s: Seed): number =>
      Math.round(s.total * (COST_RATE[s.category] ?? 0));
    const variableCost = paid.reduce((a, s) => a + cost(s), 0);
    const byCategory = CATEGORIES.flatMap((category) => {
      const of = paid.filter((s) => s.category === category);
      if (of.length === 0) return [];
      const rev = of.reduce((a, s) => a + s.total, 0);
      const vc = of.reduce((a, s) => a + cost(s), 0);
      return [
        {
          category,
          revenue: rev,
          variableCost: vc,
          margin: rev - vc,
          variableCostRate: rev === 0 ? null : rate(vc / rev),
        },
      ];
    });
    const delivered = rows.filter((s) => s.outcome === 'entregado');
    const zoneIds = [...new Set(delivered.map((s) => s.zoneId))];
    const surveyed = delivered.filter((s) => s.rating !== null);
    const ratings = surveyed.map((s) => s.rating as number);
    const per = new Map<string, number>();
    for (const s of paid) per.set(s.customer, (per.get(s.customer) ?? 0) + 1);
    const repeat = [...per.values()].filter((c) => c >= 2).length;
    return {
      status: 200,
      body: {
        period: { from: r.from, to: r.to, days, zoneId },
        sales: {
          orders: paid.length,
          revenue,
          averageTicket:
            paid.length === 0 ? 0 : Math.round(revenue / paid.length),
          daily,
        },
        margin: {
          revenue,
          variableCost,
          margin: revenue - variableCost,
          variableCostRate: revenue === 0 ? null : rate(variableCost / revenue),
          byCategory,
        },
        delivery: {
          ...timing(delivered),
          onTimeThresholdMinutes: 15,
          byZone: zoneIds.map((id) => ({
            zoneName: zones().find((z) => z.id === id)?.name ?? id,
            ...timing(delivered.filter((s) => s.zoneId === id)),
          })),
        },
        satisfaction: {
          responses: ratings.length,
          average: mean(ratings),
          responseRate:
            delivered.length === 0
              ? null
              : rate(ratings.length / delivered.length),
          distribution: Object.fromEntries(
            [1, 2, 3, 4, 5].map((n) => [
              n,
              ratings.filter((x) => x === n).length,
            ]),
          ),
        },
        retention: {
          customers: per.size,
          repeatCustomers: repeat,
          repeatRate: per.size === 0 ? 0 : rate(repeat / per.size),
        },
        outcomes: {
          entregado: delivered.length,
          no_entregado: rows.filter((s) => s.outcome === 'no_entregado').length,
          cancelado: rows.filter((s) => s.outcome === 'cancelado').length,
          enCurso: rows.filter((s) => s.outcome === 'enCurso').length,
        },
      },
    };
  }

  function surveys(query: URLSearchParams): InsightsResult {
    if (seeds.length === 0) seeds = build();
    const num = (
      key: string,
      def: number,
      min: number,
      max: number,
    ): number | null => {
      const raw = query.get(key);
      if (raw === null) return def;
      if (!/^[1-9]\d*$/.test(raw)) return null;
      const v = Number(raw);
      return v >= min && v <= max ? v : null;
    };
    const page = num('page', 1, 1, 10000);
    const limit = num('limit', 20, 1, 100);
    const rating = query.has('rating') ? num('rating', 0, 1, 5) : 0;
    if (page === null || limit === null || rating === null)
      return fail(400, 'Parámetros inválidos.');
    const from = query.get('from');
    const to = query.get('to');
    if ((from !== null && !isRealDay(from)) || (to !== null && !isRealDay(to)))
      return fail(400, BAD_DATE);
    if (from !== null && to !== null && from > to) return fail(400, BAD_RANGE);
    const all = seeds
      .filter((s) => s.rating !== null && s.surveyAt !== null)
      .filter((s) => rating === 0 || s.rating === rating)
      .filter(
        (s) => from === null || dayOf(Date.parse(s.surveyAt as string)) >= from,
      )
      .filter(
        (s) => to === null || dayOf(Date.parse(s.surveyAt as string)) <= to,
      )
      .sort((a, b) =>
        (b.surveyAt as string).localeCompare(a.surveyAt as string),
      );
    const data = all.slice((page - 1) * limit, page * limit).map((s) => ({
      orderId: s.id,
      rating: s.rating,
      comment: s.comment,
      createdAt: s.surveyAt,
      number: s.number,
      customer: { name: s.customer },
      zoneName: zones().find((z) => z.id === s.zoneId)?.name ?? '',
    }));
    return {
      status: 200,
      body: {
        page,
        limit,
        total: all.length,
        totalPages: Math.ceil(all.length / limit),
        data,
      },
    };
  }

  return {
    metrics,
    surveys,
    reset: () => {
      seeds = [];
    },
  };
}

function fail(status: number, message: string): InsightsResult {
  return { status, body: { statusCode: status, message, error: 'Error' } };
}
