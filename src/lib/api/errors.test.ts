import { describe, expect, it } from 'vitest';
import {
  ApiError,
  describeApiError,
  isApiError,
  MESSAGES,
  networkError,
  parseApiError,
} from './errors';

describe('parseApiError', () => {
  it('message como texto → una línea', () => {
    const error = parseApiError(409, {
      statusCode: 409,
      message: 'El correo ya está registrado',
      error: 'Conflict',
    });
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(409);
    expect(error.messages).toEqual(['El correo ya está registrado']);
    expect(error.error).toBe('Conflict');
    expect(error.message).toBe('El correo ya está registrado');
  });

  it('message como arreglo → lista', () => {
    const error = parseApiError(400, { statusCode: 400, message: ['a', 'b'] });
    expect(error.messages).toEqual(['a', 'b']);
  });

  it('descarta elementos que no son texto', () => {
    expect(
      parseApiError(400, { message: ['a', 3, '', null] }).messages,
    ).toEqual(['a']);
  });

  it.each([
    null,
    undefined,
    '<html>502</html>',
    42,
    {},
    { message: '' },
    { message: [] },
  ])('cuerpo no usable %j → mensaje genérico', (body) => {
    expect(parseApiError(500, body).messages).toEqual([MESSAGES.generic]);
  });

  it('usa textos fijos para 429 y para fallos de conexión', () => {
    expect(parseApiError(429, '<html>').messages).toEqual([
      MESSAGES.tooManyRequests,
    ]);
    expect(parseApiError(502, null).messages).toEqual([MESSAGES.unreachable]);
    expect(parseApiError(504, null).messages).toEqual([MESSAGES.unreachable]);
  });
});

describe('describeApiError', () => {
  it('429 siempre usa el texto fijo', () => {
    expect(
      describeApiError(parseApiError(429, { message: 'ThrottlerException' })),
    ).toEqual([MESSAGES.tooManyRequests]);
  });

  it('502, 504 y la red caída usan «No pudimos conectar con el servidor»', () => {
    for (const error of [
      parseApiError(502, { message: 'x' }),
      parseApiError(504, {}),
      networkError(),
    ]) {
      expect(describeApiError(error)).toEqual([MESSAGES.unreachable]);
      expect(error.isUnreachable).toBe(true);
    }
  });

  it('el resto conserva los mensajes del servidor', () => {
    expect(
      describeApiError(parseApiError(400, { message: ['uno', 'dos'] })),
    ).toEqual(['uno', 'dos']);
    expect(parseApiError(400, { message: 'x' }).isUnreachable).toBe(false);
  });

  it('un error cualquiera → mensaje genérico', () => {
    expect(describeApiError(new Error('boom'))).toEqual([MESSAGES.generic]);
    expect(isApiError(new Error('boom'))).toBe(false);
  });
});
