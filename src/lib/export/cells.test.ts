import { describe, expect, it } from 'vitest';
import { bogotaWallClock, dayToDate, safeText } from './cells';
import { metricsFileName, slug, surveysFileName } from './filename';

describe('texto seguro para hojas de cálculo', () => {
  it.each(['=1+1', '+57300', '-2+3', '@SUMA(A1)', '\tx', '\nx', '\rx'])(
    'neutraliza «%s» con una comilla simple',
    (v) => expect(safeText(v)).toBe(`'${v}`),
  );
  it('deja igual el texto normal y vacía lo vacío', () => {
    expect(safeText('Llegó caliente')).toBe('Llegó caliente');
    expect(safeText('a=b')).toBe('a=b');
    expect(safeText('')).toBeUndefined();
    expect(safeText(null)).toBeUndefined();
    expect(safeText(undefined)).toBeUndefined();
  });
});

describe('fechas de Excel', () => {
  it('un día es medianoche UTC; la hora se corre a «hora de pared» de Colombia', () => {
    expect(dayToDate('2026-11-05').toISOString()).toBe(
      '2026-11-05T00:00:00.000Z',
    );
    expect(bogotaWallClock('2026-11-05T20:30:00Z').toISOString()).toBe(
      '2026-11-05T15:30:00.000Z',
    );
    expect(bogotaWallClock('2026-11-06T03:00:00Z').toISOString()).toBe(
      '2026-11-05T22:00:00.000Z',
    );
  });
});

describe('nombres de archivo', () => {
  it('slug: sin tildes, espacios ni símbolos', () => {
    expect(slug('Zona Samán / Norte #2')).toBe('zona-saman-norte-2');
    expect(slug('../../etc')).toBe('etc');
    expect(slug('***')).toBe('');
  });
  it('métricas con y sin zona; encuestas con la fecha', () => {
    expect(metricsFileName('2026-10-14', '2026-11-12', null)).toBe(
      'mocca-go-metricas_2026-10-14_a_2026-11-12.xlsx',
    );
    expect(metricsFileName('2026-10-14', '2026-11-12', 'Zona 1')).toBe(
      'mocca-go-metricas_2026-10-14_a_2026-11-12_zona-1.xlsx',
    );
    expect(surveysFileName('2026-11-12')).toBe(
      'mocca-go-encuestas_2026-11-12.xlsx',
    );
  });
});
