import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { AMBIGUOUS_USER, describeUserError } from './errors';

const api = (status: number, ...messages: string[]) =>
  new ApiError(status, messages);

describe('describeUserError', () => {
  it('409 de usuario repetido va bajo el campo Usuario', () => {
    expect(describeUserError(api(409, 'El username ya existe.'))).toEqual({
      kind: 'duplicate',
      fields: { username: 'El username ya existe.' },
      messages: [],
    });
  });
  it('otros 409 muestran siempre el texto del back', () => {
    for (const text of [
      'No se puede eliminar al último administrador.',
      'No puedes eliminar tu propio usuario.',
      'El usuario tiene historial asociado; no se puede eliminar.',
      'No puedes cambiar tu propio rol.',
      'Un cliente no cambia de rol.',
      'Un texto nuevo que el front no conoce.',
    ])
      expect(describeUserError(api(409, text))).toMatchObject({
        kind: 'conflict',
        messages: [text],
      });
  });
  it('404 explica que el usuario ya no existe', () => {
    expect(describeUserError(api(404, 'Usuario no encontrado.'))).toMatchObject(
      {
        kind: 'missing',
        messages: ['Usuario no encontrado.'],
      },
    );
  });
  it('400 se reparte por campo según el texto', () => {
    const r = describeUserError(
      api(
        400,
        'username no cumple el formato permitido',
        'El nombre del personal admite de 2 a 80 caracteres.',
        'phone debe ser un celular colombiano o un número internacional válido.',
        'password debe tener entre 12 y 128 caracteres',
        'Algo más',
      ),
    );
    expect(r.kind).toBe('validation');
    expect(Object.keys(r.fields).sort()).toEqual([
      'fullName',
      'password',
      'phone',
      'username',
    ]);
    expect(r.messages).toEqual(['Algo más']);
  });
  it('el 400 de repartidor sin datos va al aviso, no a un campo', () => {
    const text =
      'Un repartidor necesita teléfono y nombre de contacto (phone y fullName).';
    expect(describeUserError(api(400, text))).toMatchObject({
      fields: {},
      messages: [text],
    });
  });
  it('red caída o 5xx es ambiguo', () => {
    expect(describeUserError(new ApiError(0, ['x'])).kind).toBe('ambiguous');
    expect(describeUserError(api(500, 'x')).messages).toEqual([AMBIGUOUS_USER]);
    expect(describeUserError(new Error('boom')).kind).toBe('other');
  });
});
