import { describe, expect, it } from 'vitest';
import { formatCOP } from './format';

describe('formatCOP', () => {
  it.each([
    [0, '$0'],
    [500, '$500'],
    [4500, '$4.500'],
    [12000, '$12.000'],
    [1234567, '$1.234.567'],
  ])('%i → %s', (amount, expected) => {
    expect(formatCOP(amount)).toBe(expected);
  });

  it('redondea a pesos enteros y soporta negativos', () => {
    expect(formatCOP(4499.6)).toBe('$4.500');
    expect(formatCOP(-2500)).toBe('-$2.500');
  });
});
