import { describe, expect, it } from 'vitest';
import { ApiError, networkError } from '@/lib/api/errors';
import {
  AMBIGUOUS_PASSWORD,
  AMBIGUOUS_PROFILE,
  describePasswordError,
  describeProfileError,
} from './errors';

describe('describeProfileError', () => {
  it('reparte los 400 por campo y deja el resto como aviso', () => {
    const e = describeProfileError(
      new ApiError(400, [
        'phone debe ser un celular colombiano o un número internacional válido.',
        'fullName debe tener entre 2 y 100 caracteres',
        'Indica al menos un campo para editar.',
      ]),
    );
    expect(e.kind).toBe('validation');
    expect(e.fields.phone).toMatch(/celular colombiano/);
    expect(e.fields.fullName).toMatch(/entre 2 y 100/);
    expect(e.messages).toEqual(['Indica al menos un campo para editar.']);
  });
  it('red y 5xx son ambiguos; 404 explica', () => {
    expect(describeProfileError(networkError())).toMatchObject({
      kind: 'ambiguous',
      messages: [AMBIGUOUS_PROFILE],
    });
    expect(describeProfileError(new ApiError(502, ['x'])).kind).toBe(
      'ambiguous',
    );
    expect(describeProfileError(new ApiError(404, ['x'])).kind).toBe('missing');
  });
});

describe('describePasswordError', () => {
  it('el 403 es contraseña actual incorrecta, no falta de permiso', () => {
    expect(
      describePasswordError(
        new ApiError(403, ['La contraseña actual no es correcta.']),
      ),
    ).toEqual({
      kind: 'current',
      messages: ['La contraseña actual no es correcta.'],
    });
  });
  it('400 «distinta», otros 400, 429 y red', () => {
    expect(
      describePasswordError(
        new ApiError(400, [
          'La contraseña nueva debe ser distinta de la actual.',
        ]),
      ).kind,
    ).toBe('same');
    expect(
      describePasswordError(
        new ApiError(400, ['newPassword debe tener entre 12 y 128 caracteres']),
      ),
    ).toEqual({
      kind: 'validation',
      messages: ['newPassword debe tener entre 12 y 128 caracteres'],
    });
    expect(describePasswordError(new ApiError(429, ['x'])).kind).toBe('other');
    expect(describePasswordError(networkError())).toEqual({
      kind: 'ambiguous',
      messages: [AMBIGUOUS_PASSWORD],
    });
  });
});
