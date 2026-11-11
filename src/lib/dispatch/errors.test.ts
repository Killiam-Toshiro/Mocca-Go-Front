import { describe, expect, it } from 'vitest';
import { ApiError, networkError } from '@/lib/api/errors';
import { describeCloseError, describeCreateRoundError } from './errors';

const api = (status: number, message: string) =>
  new ApiError(status, [message]);

describe('errores de despacho', () => {
  it.each([
    [
      'Tu perfil de repartidor no tiene el nombre completo ni el teléfono; pídele al administrador que lo complete.',
      'profile',
    ],
    [
      'Ya tienes 2 rondas activas; termina una antes de salir con otra.',
      'rounds-limit',
    ],
    ['No hay pedidos listos para despachar.', 'no-ready'],
    ['Los pedidos #1042, #1043 ya no están en estado «listo».', 'taken'],
    [
      'Una ronda es de una sola zona; elegiste pedidos de: Zona 1, Zona 2.',
      'zones',
    ],
    ['Algo que no conocemos', 'conflict'],
  ])('crear ronda 409 «%s» → %s', (message, kind) => {
    const r = describeCreateRoundError(api(409, message));
    expect(r.kind).toBe(kind);
    if (kind === 'taken') expect(r.messages[0]).toContain('#1042, #1043');
    if (kind === 'conflict') expect(r.messages).toEqual([message]);
  });

  it('crear ronda: 404, 400, red y 5xx', () => {
    expect(describeCreateRoundError(api(404, 'x')).kind).toBe('missing');
    expect(describeCreateRoundError(api(400, 'orderIds inválido'))).toEqual({
      kind: 'validation',
      messages: ['orderIds inválido'],
    });
    expect(describeCreateRoundError(networkError()).kind).toBe('ambiguous');
    expect(describeCreateRoundError(api(503, 'x')).kind).toBe('ambiguous');
  });

  it('cerrar pedido: 409, 404, 400, red y 5xx', () => {
    expect(describeCloseError(api(409, 'x')).kind).toBe('conflict');
    expect(describeCloseError(api(404, 'x')).kind).toBe('missing');
    expect(describeCloseError(api(400, 'reason inválido')).messages).toEqual([
      'reason inválido',
    ]);
    expect(describeCloseError(networkError()).kind).toBe('ambiguous');
    expect(describeCloseError(api(500, 'x')).kind).toBe('ambiguous');
    expect(describeCloseError(new Error('x')).kind).toBe('other');
  });
});
