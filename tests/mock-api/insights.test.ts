import { describe, expect, it } from 'vitest';
import {
  BAD_DATE,
  BAD_RANGE,
  TOO_LONG,
  ZONE_MISSING,
  createInsightsStore,
} from './insights';

const Z1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const Z2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const zones = [
  { id: Z1, name: 'Zona 1' },
  { id: Z2, name: 'Zona 2' },
];
const q = (o: Record<string, string> = {}) => new URLSearchParams(o);
interface M {
  period: { days: number; from: string; to: string };
  sales: {
    orders: number;
    revenue: number;
    daily: { date: string; orders: number }[];
  };
  margin: { revenue: number; variableCost: number; margin: number };
  delivery: { delivered: number; byZone: { zoneName: string }[] };
  satisfaction: { responses: number; distribution: Record<string, number> };
  outcomes: {
    entregado: number;
    no_entregado: number;
    cancelado: number;
    enCurso: number;
  };
}

describe('mock de métricas y encuestas', () => {
  it('por defecto: últimos 30 días con ceros y suma coherente', () => {
    const r = createInsightsStore(() => zones).metrics(q());
    const m = r.body as M;
    expect(r.status).toBe(200);
    expect(m.period.days).toBe(30);
    expect(m.sales.daily).toHaveLength(30);
    expect(m.sales.daily.reduce((a, d) => a + d.orders, 0)).toBe(
      m.sales.orders,
    );
    expect(m.margin.margin).toBe(m.margin.revenue - m.margin.variableCost);
    const o = m.outcomes;
    expect(o.entregado + o.no_entregado + o.cancelado + o.enCurso).toBe(90);
  });

  it('un periodo sin pedidos devuelve ceros y null, no tasas inventadas', () => {
    const r = createInsightsStore(() => zones).metrics(
      q({ from: '2020-01-01', to: '2020-01-05' }),
    );
    const m = r.body as {
      sales: { orders: number };
      delivery: { onTimeRate: number | null };
      satisfaction: { average: number | null };
      margin: { variableCostRate: number | null };
    };
    expect(m.sales.orders).toBe(0);
    expect(m.delivery.onTimeRate).toBeNull();
    expect(m.satisfaction.average).toBeNull();
    expect(m.margin.variableCostRate).toBeNull();
  });

  it('filtra por zona y valida zona, fechas y rango', () => {
    const s = createInsightsStore(() => zones);
    const all = s.metrics(q()).body as M;
    const one = s.metrics(q({ zoneId: Z1 })).body as M;
    expect(one.sales.orders).toBeLessThan(all.sales.orders);
    expect(one.delivery.byZone.map((z) => z.zoneName)).toEqual(['Zona 1']);
    const missing = s.metrics(
      q({ zoneId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc' }),
    );
    expect(missing.status).toBe(404);
    expect(JSON.stringify(missing.body)).toContain(ZONE_MISSING);
    expect(s.metrics(q({ from: '2026-13-40' })).body).toMatchObject({
      message: BAD_DATE,
    });
    expect(
      s.metrics(q({ from: '2026-05-02', to: '2026-05-01' })).body,
    ).toMatchObject({
      message: BAD_RANGE,
    });
    expect(
      s.metrics(q({ from: '2024-01-01', to: '2026-01-01' })).body,
    ).toMatchObject({
      message: TOO_LONG,
    });
  });

  it('encuestas: más reciente primero, filtra por calificación y pagina', () => {
    const s = createInsightsStore(() => zones);
    const page = s.surveys(q({ limit: '5' })).body as {
      total: number;
      totalPages: number;
      data: { rating: number; createdAt: string }[];
    };
    expect(page.data).toHaveLength(5);
    const dates = page.data.map((d) => d.createdAt);
    expect([...dates].sort().reverse()).toEqual(dates);
    expect(page.totalPages).toBe(Math.ceil(page.total / 5));
    const fives = s.surveys(q({ rating: '5' })).body as {
      data: { rating: number }[];
    };
    expect(fives.data.every((d) => d.rating === 5)).toBe(true);
    expect(s.surveys(q({ rating: '6' })).status).toBe(400);
    expect(s.surveys(q({ page: '0' })).status).toBe(400);
  });
});
