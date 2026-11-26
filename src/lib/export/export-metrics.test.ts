import { describe, expect, it } from 'vitest';
import { createInsightsStore } from '../../../tests/mock-api/insights';
import { readXlsx } from '../../../tests/utils/xlsx';
import type { Metrics } from '@/lib/metrics/types';
import { exportMetrics } from './export-metrics';

const Z = [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Zona 1' },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Zona 2' },
];
const get = (q: Record<string, string> = {}) =>
  createInsightsStore(() => Z).metrics(new URLSearchParams(q)).body as Metrics;

async function run(m: Metrics, zoneName: string | null = null) {
  let saved: { blob: Blob; name: string } | null = null;
  const name = await exportMetrics(m, {
    zoneName,
    consultedAt: Date.parse('2026-11-12T20:30:00Z'),
    save: (blob, n) => {
      saved = { blob, name: n };
    },
  });
  expect(saved).not.toBeNull();
  const book = await readXlsx((saved as unknown as { blob: Blob }).blob);
  return { name, book };
}

describe('exportar métricas a Excel', () => {
  it('trae las cinco hojas con números reales y formatos', async () => {
    const m = get();
    const { name, book } = await run(m, null);
    expect(name).toBe(
      `mocca-go-metricas_${m.period.from}_a_${m.period.to}.xlsx`,
    );
    expect(book.worksheets.map((w) => w.name)).toEqual([
      'Resumen',
      'Ventas por día',
      'Margen por categoría',
      'Entregas por zona',
      'Satisfacción',
    ]);
    const resumen = book.getWorksheet('Resumen')!;
    const row = (label: string) => {
      let found;
      resumen.eachRow((r) => {
        if (r.getCell(1).value === label) found = r.getCell(2);
      });
      return found as unknown as { value: unknown; numFmt: string };
    };
    expect(row('Ingresos').value).toBe(m.sales.revenue);
    expect(row('Ingresos').numFmt).toBe('"$"#,##0');
    expect(row('Margen').value).toBe(m.margin.margin);
    expect(row('Entregados a tiempo').value).toBe(m.delivery.onTimeRate);
    expect(row('Entregados a tiempo').numFmt).toBe('0.0%');
    expect(row('Tiempo total p90 (min)').value).toBe(
      m.delivery.totalMinutes.p90,
    );
    expect(row('Zona').value).toBe('Todas las zonas');
    expect(
      (row('Periodo desde').value as Date).toISOString().slice(0, 10),
    ).toBe(m.period.from);
    expect(
      (row('Consultado (hora de Colombia)').value as Date).toISOString(),
    ).toBe('2026-11-12T15:30:00.000Z');
    const ventas = book.getWorksheet('Ventas por día')!;
    expect(ventas.rowCount).toBe(1 + m.sales.daily.length);
    expect(ventas.getRow(1).font?.bold).toBe(true);
    expect(ventas.views[0]).toMatchObject({ state: 'frozen', ySplit: 1 });
    expect(ventas.autoFilter).toBeTruthy();
    const first = m.sales.daily[0]!;
    expect(ventas.getCell('B2').value).toBe(first.orders);
    expect(ventas.getCell('C2').value).toBe(first.revenue);
    const zonas = book.getWorksheet('Entregas por zona')!;
    expect(zonas.rowCount).toBe(1 + m.delivery.byZone.length);
    const sat = book.getWorksheet('Satisfacción')!;
    expect(sat.getCell('B6').value).toBe(m.satisfaction.distribution['5']);
    const margen = book.getWorksheet('Margen por categoría')!;
    expect(margen.getCell('A2').value).toMatch(/^[A-ZÁ-Ú]/);
  });

  it('un periodo sin datos deja celdas vacías, no ceros inventados', async () => {
    const m = get({ from: '2020-01-01', to: '2020-01-05' });
    const { book } = await run(m, 'Zona 1');
    const resumen = book.getWorksheet('Resumen')!;
    const cell = (label: string) => {
      let v: unknown = 'no-encontrada';
      resumen.eachRow((r) => {
        if (r.getCell(1).value === label) v = r.getCell(2).value;
      });
      return v;
    };
    expect(cell('Entregados a tiempo')).toBeNull();
    expect(cell('Calificación promedio (de 5)')).toBeNull();
    expect(cell('Tiempo total promedio (min)')).toBeNull();
    expect(cell('Ticket promedio')).toBeNull();
    expect(cell('Tasa de recompra')).toBeNull();
    expect(cell('Zona')).toBe('Zona 1');
    expect(book.getWorksheet('Entregas por zona')!.rowCount).toBe(1);
  });

  it('el nombre del archivo lleva la zona', async () => {
    const { name } = await run(get(), 'Zona 1');
    expect(name).toMatch(/_zona-1\.xlsx$/);
  });

  it('un nombre de zona que parece fórmula queda como texto', async () => {
    const { book } = await run(get(), '=HYPERLINK("http://x")');
    const resumen = book.getWorksheet('Resumen')!;
    let v: unknown;
    resumen.eachRow((r) => {
      if (r.getCell(1).value === 'Zona') v = r.getCell(2).value;
    });
    expect(v).toBe(`'=HYPERLINK("http://x")`);
  });
});
