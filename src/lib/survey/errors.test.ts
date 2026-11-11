import { describe, expect, it } from 'vitest';
import { ApiError, networkError } from '@/lib/api/errors';
import { AMBIGUOUS_SURVEY, describeSurveyError } from './errors';

describe('describeSurveyError', () => {
  it('reconoce los 409 por el texto del back', () => {
    expect(
      describeSurveyError(
        new ApiError(409, [
          'Este pedido ya tiene una respuesta de la encuesta.',
        ]),
      ).kind,
    ).toBe('already');
    expect(
      describeSurveyError(
        new ApiError(409, [
          'El pedido #7 está en estado «en_camino»; la encuesta se responde cuando está «entregado».',
        ]),
      ).kind,
    ).toBe('state');
    const other = describeSurveyError(new ApiError(409, ['Otro conflicto']));
    expect(other).toEqual({ kind: 'state', messages: ['Otro conflicto'] });
  });
  it('404, 400 y red', () => {
    expect(describeSurveyError(new ApiError(404, ['x'])).kind).toBe('missing');
    expect(
      describeSurveyError(
        new ApiError(400, ['comment debe tener entre 1 y 300 caracteres']),
      ),
    ).toEqual({
      kind: 'validation',
      messages: ['comment debe tener entre 1 y 300 caracteres'],
    });
    expect(describeSurveyError(networkError())).toEqual({
      kind: 'ambiguous',
      messages: [AMBIGUOUS_SURVEY],
    });
    expect(describeSurveyError(new ApiError(503, ['x'])).kind).toBe(
      'ambiguous',
    );
    expect(describeSurveyError(new ApiError(403, ['x'])).kind).toBe('other');
  });
});
