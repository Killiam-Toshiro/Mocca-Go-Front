import { describe, expect, it } from 'vitest';
import { networkError, parseApiError } from '@/lib/api/errors';
import { describeKitchenError } from './errors';

describe('describeKitchenError', () => {
  it('409 es conflicto con otro operador', () => {
    expect(describeKitchenError(parseApiError(409, { message: 'x' }))).toEqual({
      kind: 'conflict',
      messages: ['Otro operador ya cambió este pedido.'],
    });
  });
  it('404 es pedido inexistente', () => {
    expect(
      describeKitchenError(parseApiError(404, { message: 'x' })).kind,
    ).toBe('missing');
  });
  it('400 trae los mensajes del back', () => {
    expect(
      describeKitchenError(
        parseApiError(400, { message: ['reason debe tener entre 1 y 200'] }),
      ),
    ).toEqual({
      kind: 'validation',
      messages: ['reason debe tener entre 1 y 200'],
    });
  });
  it('sin conexión y otros errores', () => {
    expect(describeKitchenError(networkError()).kind).toBe('network');
    expect(describeKitchenError(parseApiError(500, {})).kind).toBe('other');
    expect(describeKitchenError(new Error('x')).kind).toBe('other');
  });
});
