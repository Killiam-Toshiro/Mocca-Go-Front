import { describe, expect, it } from 'vitest';
import { cn } from './utils';

describe('cn', () => {
  it('une clases y resuelve conflictos de Tailwind a favor de la última', () => {
    expect(cn('px-2 py-1', 'px-4')).toBe('py-1 px-4');
  });

  it('ignora valores falsos', () => {
    expect(cn('a', false && 'b', undefined, null, 'c')).toBe('a c');
  });
});
