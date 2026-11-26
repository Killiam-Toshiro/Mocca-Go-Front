import { describe, expect, it } from 'vitest';
import { ApiError, networkError, parseApiError } from '@/lib/api/errors';
import { describeOrderError } from './errors';

describe('describeOrderError', () => {
  it('402 → tarjeta', () => {
    expect(describeOrderError(parseApiError(402, { message: 'x' }))).toEqual({
      kind: 'card',
      messages: ['La tarjeta fue rechazada.'],
    });
  });
  it.each([404, 409])('%i → conflicto con el mensaje del back', (status) => {
    expect(
      describeOrderError(
        parseApiError(status, { message: 'Capuchino está agotado' }),
      ),
    ).toEqual({
      kind: 'conflict',
      messages: ['Capuchino está agotado'],
    });
  });
  it('400 → validación con todos los mensajes', () => {
    expect(
      describeOrderError(parseApiError(400, { message: ['a', 'b'] })).messages,
    ).toEqual(['a', 'b']);
  });
  it('429, red y 5xx', () => {
    expect(describeOrderError(parseApiError(429, null)).kind).toBe('rate');
    expect(describeOrderError(networkError()).kind).toBe('network');
    expect(describeOrderError(new ApiError(502, ['x'])).kind).toBe('network');
    expect(describeOrderError(new ApiError(500, ['x'])).kind).toBe('other');
    expect(describeOrderError(new Error('x')).kind).toBe('other');
  });
});
