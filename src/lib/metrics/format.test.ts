import { describe, expect, it } from 'vitest';
import {
  NO_DATA,
  formatCount,
  formatDay,
  formatDayLong,
  formatMinutes,
  formatPercent,
  formatRating,
} from './format';

describe('formato de métricas', () => {
  it('porcentajes: null nunca es 0 %', () => {
    expect(formatPercent(null)).toBe(NO_DATA);
    expect(formatPercent(undefined)).toBe(NO_DATA);
    expect(formatPercent(0)).toBe('0 %');
    expect(formatPercent(0.91)).toBe('91 %');
    expect(formatPercent(0.914)).toBe('91,4 %');
    expect(formatPercent(1)).toBe('100 %');
  });
  it('minutos y calificación con coma decimal', () => {
    expect(formatMinutes(21.4)).toBe('21,4 min');
    expect(formatMinutes(20)).toBe('20,0 min');
    expect(formatMinutes(null)).toBe(NO_DATA);
    expect(formatRating(4.4)).toBe('4,4');
    expect(formatRating(null)).toBe(NO_DATA);
  });
  it('días sin correrse por zona horaria', () => {
    expect(formatDay('2026-11-05')).toBe('5 nov');
    expect(formatDay('2026-01-01')).toBe('1 ene');
    expect(formatDayLong('2026-11-05')).toBe('5 nov 2026');
  });
  it('cantidades con punto de miles', () => {
    expect(formatCount(1234)).toBe('1.234');
    expect(formatCount(7)).toBe('7');
  });
});
