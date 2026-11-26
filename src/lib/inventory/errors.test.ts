import { describe, expect, it } from 'vitest';
import { networkError, parseApiError } from '@/lib/api/errors';
import { AMBIGUOUS, describeInventoryError } from './errors';

describe('describeInventoryError', () => {
  it('404 es producto inexistente', () => {
    expect(
      describeInventoryError(parseApiError(404, { message: 'x' })),
    ).toEqual({
      kind: 'missing',
      messages: ['Este producto ya no existe.'],
    });
  });
  it('409 trae el mensaje del back (saldo insuficiente, inactivo, máximo)', () => {
    expect(
      describeInventoryError(
        parseApiError(409, { message: 'Saldo insuficiente: hay 3' }),
      ),
    ).toEqual({ kind: 'conflict', messages: ['Saldo insuficiente: hay 3'] });
  });
  it('400 trae los mensajes del back', () => {
    expect(
      describeInventoryError(
        parseApiError(400, { message: ['reason inválido'] }),
      ).kind,
    ).toBe('validation');
  });
  it('un corte de red o un 5xx al registrar es ambiguo; al agotar es solo de red', () => {
    for (const error of [
      networkError(),
      parseApiError(500, {}),
      parseApiError(504, {}),
    ]) {
      expect(describeInventoryError(error, { writes: true })).toEqual({
        kind: 'ambiguous',
        messages: [AMBIGUOUS],
      });
    }
    expect(describeInventoryError(networkError()).kind).toBe('network');
    expect(describeInventoryError(parseApiError(500, {})).kind).toBe('network');
  });
  it('otros errores', () => {
    expect(describeInventoryError(parseApiError(403, {})).kind).toBe('other');
    expect(describeInventoryError(new Error('x')).kind).toBe('other');
  });
});
