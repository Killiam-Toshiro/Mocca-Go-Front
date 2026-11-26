import { describe, expect, it } from 'vitest';
import {
  activePreset,
  addDays,
  daysBetween,
  isIsoDay,
  parseMetricsFilters,
  presetRange,
  todayBogota,
  validatePeriod,
} from './period';

const p = (q: string) => new URLSearchParams(q);

describe('periodo de métricas', () => {
  it('hoy se toma en Colombia, no en UTC', () => {
    expect(todayBogota(new Date('2026-11-06T03:30:00Z'))).toBe('2026-11-05');
    expect(todayBogota(new Date('2026-11-06T05:00:00Z'))).toBe('2026-11-06');
  });

  it('suma días y cuenta ambos extremos', () => {
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(daysBetween('2026-10-07', '2026-11-05')).toBe(30);
  });

  it('valida fechas reales', () => {
    expect(isIsoDay('2026-02-31')).toBe(false);
    expect(isIsoDay('2026-2-3')).toBe(false);
    expect(isIsoDay('2026-02-28')).toBe(true);
    expect(isIsoDay(null)).toBe(false);
  });

  it('atajos: 7, 30, 90 días y este mes', () => {
    expect(presetRange('7d', '2026-11-12')).toEqual({
      from: '2026-11-06',
      to: '2026-11-12',
    });
    expect(presetRange('30d', '2026-11-05')).toEqual({
      from: '2026-10-07',
      to: '2026-11-05',
    });
    expect(presetRange('mes', '2026-11-12').from).toBe('2026-11-01');
    expect(
      activePreset({ from: '2026-10-07', to: '2026-11-05' }, '2026-11-05'),
    ).toBe('30d');
    expect(
      activePreset({ from: '2026-10-08', to: '2026-11-05' }, '2026-11-05'),
    ).toBeNull();
  });

  it('rango inválido: invertido, vacío o de más de 366 días', () => {
    expect(validatePeriod('2026-05-02', '2026-05-01')).toMatch(/posterior/);
    expect(validatePeriod('', '2026-05-01')).toMatch(/dos fechas/);
    expect(validatePeriod('2025-01-01', '2025-12-31')).toBeNull();
    expect(validatePeriod('2025-01-01', '2026-01-02')).toMatch(/366/);
    expect(validatePeriod('2025-01-01', '2026-01-01')).toBeNull();
  });

  it('la URL manda; sin fechas válidas usa 30 días y una zona inválida se ignora', () => {
    const f = parseMetricsFilters(
      p(
        'from=2026-10-01&to=2026-10-10&zoneId=aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      ),
      '2026-11-05',
    );
    expect(f).toMatchObject({
      from: '2026-10-01',
      to: '2026-10-10',
      zoneId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      error: null,
    });
    const d = parseMetricsFilters(p('from=x&zoneId=no'), '2026-11-05');
    expect(d).toMatchObject({
      from: '2026-10-07',
      to: '2026-11-05',
      zoneId: null,
      error: null,
    });
    expect(
      parseMetricsFilters(p('from=2026-10-10&to=2026-10-01'), '2026-11-05')
        .error,
    ).toMatch(/posterior/);
  });
});
