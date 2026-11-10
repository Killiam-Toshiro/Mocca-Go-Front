import { describe, expect, it } from 'vitest';
import { freshnessLabel, shortOrderId } from './format';

describe('freshnessLabel', () => {
  const t = 1_000_000;
  it('ahora, segundos y minutos', () => {
    expect(freshnessLabel(t, t + 3_000)).toBe('Actualizado ahora');
    expect(freshnessLabel(t, t + 12_000)).toBe('Actualizado hace 12 s');
    expect(freshnessLabel(t, t + 59_000)).toBe('Actualizado hace 59 s');
    expect(freshnessLabel(t, t + 125_000)).toBe('Actualizado hace 2 min');
  });
  it('un reloj adelantado no da negativos', () => {
    expect(freshnessLabel(t + 10_000, t)).toBe('Actualizado ahora');
  });
});

describe('shortOrderId', () => {
  it('toma los últimos 6 caracteres sin guiones', () => {
    expect(shortOrderId('3f2a9c1e-0b7d-4e5a-9c1d-aabbccddeeff')).toBe('ddeeff');
    expect(shortOrderId('abc')).toBe('abc');
  });
});
