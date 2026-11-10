import { describe, expect, it } from 'vitest';
import { BACKOFF_MAX_MS, nextDelay } from './backoff';

describe('nextDelay', () => {
  const mid = () => 0.5;
  it('duplica hasta el tope de 30 s', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 10].map((n) => nextDelay(n, mid))).toEqual([
      1000, 2000, 4000, 8000, 16000, 30000, 30000, 30000,
    ]);
  });

  it('varía ±20 % y nunca pasa del tope', () => {
    expect(nextDelay(2, () => 0)).toBe(3200);
    expect(nextDelay(2, () => 1)).toBe(4800);
    expect(nextDelay(9, () => 1)).toBe(BACKOFF_MAX_MS);
  });

  it('un intento negativo se trata como el primero', () => {
    expect(nextDelay(-3, mid)).toBe(1000);
  });
});
