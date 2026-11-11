import { describe, expect, it } from 'vitest';
import {
  clampPage,
  paginate,
  pageWindow,
  rangeLabel,
  totalPagesOf,
} from './pagination';

describe('pageWindow', () => {
  it('con pocas páginas las muestra todas', () => {
    expect(pageWindow(1, 1)).toEqual([1]);
    expect(pageWindow(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(pageWindow(1, 0)).toEqual([]);
  });
  it('siempre son 7 casillas con muchas páginas', () => {
    for (let page = 1; page <= 20; page += 1)
      expect(pageWindow(page, 20)).toHaveLength(7);
  });
  it('pegada al inicio, al final y en medio', () => {
    expect(pageWindow(1, 20)).toEqual([1, 2, 3, 4, 5, 'gap-end', 20]);
    expect(pageWindow(3, 20)).toEqual([1, 2, 3, 4, 5, 'gap-end', 20]);
    expect(pageWindow(4, 20)).toEqual([1, 'gap-start', 3, 4, 5, 'gap-end', 20]);
    expect(pageWindow(20, 20)).toEqual([1, 'gap-start', 16, 17, 18, 19, 20]);
    expect(pageWindow(10, 20)).toEqual([
      1,
      'gap-start',
      9,
      10,
      11,
      'gap-end',
      20,
    ]);
  });
  it('una página fuera de rango se ajusta', () => {
    expect(pageWindow(99, 20)).toEqual(pageWindow(20, 20));
    expect(pageWindow(-3, 20)).toEqual(pageWindow(1, 20));
  });
});

describe('clampPage / totalPagesOf', () => {
  it('deja la página dentro de rango', () => {
    expect(clampPage(0, 5)).toBe(1);
    expect(clampPage(9, 5)).toBe(5);
    expect(clampPage(2.7, 5)).toBe(2);
    expect(clampPage(3, 0)).toBe(1);
    expect(clampPage(Number.NaN, 5)).toBe(1);
  });
  it('cuenta páginas', () => {
    expect(totalPagesOf(0, 20)).toBe(0);
    expect(totalPagesOf(20, 20)).toBe(1);
    expect(totalPagesOf(21, 20)).toBe(2);
  });
});

describe('paginate / rangeLabel', () => {
  const items = Array.from({ length: 45 }, (_, i) => i + 1);
  it('corta la lista por página', () => {
    expect(paginate(items, 1, 20)).toHaveLength(20);
    expect(paginate(items, 3, 20)).toEqual([41, 42, 43, 44, 45]);
    expect(paginate(items, 99, 20)).toEqual([41, 42, 43, 44, 45]);
    expect(paginate([], 1, 20)).toEqual([]);
  });
  it('dice el rango mostrado', () => {
    expect(rangeLabel(1, 20, 45)).toBe('1–20 de 45');
    expect(rangeLabel(3, 20, 45)).toBe('41–45 de 45');
    expect(rangeLabel(1, 20, 0)).toBe('0 resultados');
  });
});
