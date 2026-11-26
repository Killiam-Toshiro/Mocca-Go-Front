import { describe, expect, it } from 'vitest';
import {
  hasSurveyFilters,
  parseSurveyFilters,
  ratingText,
  surveyParams,
} from './filters';

const p = (q: string) => new URLSearchParams(q);

describe('filtros de encuestas', () => {
  it('lee la URL y descarta lo inválido', () => {
    expect(
      parseSurveyFilters(p('page=3&rating=4&from=2026-10-01&to=2026-10-31')),
    ).toEqual({
      page: 3,
      rating: 4,
      from: '2026-10-01',
      to: '2026-10-31',
      error: null,
    });
    const bad = parseSurveyFilters(
      p('page=0&rating=9&from=ayer&to=2026-02-31'),
    );
    expect(bad).toEqual({
      page: 1,
      rating: null,
      from: null,
      to: null,
      error: null,
    });
    expect(hasSurveyFilters(bad)).toBe(false);
  });
  it('fechas invertidas se marcan sin consultar', () => {
    const f = parseSurveyFilters(p('from=2026-10-31&to=2026-10-01'));
    expect(f.error).toMatch(/posterior/);
    expect(hasSurveyFilters(f)).toBe(true);
  });
  it('arma la URL sin la página 1 ni lo vacío', () => {
    expect(
      surveyParams({ page: 1, rating: null, from: null, to: null }).toString(),
    ).toBe('');
    expect(
      surveyParams({
        page: 2,
        rating: 5,
        from: '2026-10-01',
        to: null,
      }).toString(),
    ).toBe('rating=5&from=2026-10-01&page=2');
    expect(ratingText(4)).toBe('4 de 5');
  });
});
