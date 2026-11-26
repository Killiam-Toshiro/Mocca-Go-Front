import { describe, expect, it } from 'vitest';
import {
  cleanComment,
  isRating,
  ratingLabel,
  ratingSummary,
  surveyBody,
} from './rating';

describe('calificación', () => {
  it('etiqueta cada opción en texto', () => {
    expect([1, 2, 3, 4, 5].map(ratingLabel)).toEqual([
      'Muy mala',
      'Mala',
      'Regular',
      'Buena',
      'Excelente',
    ]);
    expect(ratingSummary(4)).toBe('4 de 5 · Buena');
    expect(ratingLabel(9)).toBe('');
  });
  it('recorta el comentario y lo omite si queda vacío', () => {
    expect(cleanComment('  Rico  ')).toBe('Rico');
    expect(cleanComment('   ')).toBeUndefined();
    expect(surveyBody(5, '   ')).toEqual({ rating: 5 });
    expect(surveyBody(3, ' ok ')).toEqual({ rating: 3, comment: 'ok' });
  });
  it('valida enteros de 1 a 5', () => {
    expect([0, 1, 5, 6, 2.5].map(isRating)).toEqual([
      false,
      true,
      true,
      false,
      false,
    ]);
  });
});
