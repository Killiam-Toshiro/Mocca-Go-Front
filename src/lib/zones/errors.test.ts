import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { describeZoneError } from './errors';

const api = (status: number, message: string | string[]) =>
  new ApiError(status, Array.isArray(message) ? message : [message]);

describe('describeZoneError', () => {
  it('un nombre repetido (zona o punto) se ubica bajo el campo nombre', () => {
    for (const text of [
      'Ya existe una zona con ese nombre.',
      'Ya existe un punto con ese nombre.',
    ]) {
      const e = describeZoneError(api(409, text));
      expect(e.kind).toBe('duplicate');
      expect(e.fields.name).toBe(text);
    }
  });

  it('el 409 por historial conserva el texto del back (la salida es desactivar)', () => {
    for (const text of [
      'El punto tiene pedidos; desactívalo en vez de eliminarlo.',
      'La zona tiene rondas de despacho; desactívala en vez de eliminarla.',
    ])
      expect(describeZoneError(api(409, text))).toMatchObject({
        kind: 'history',
        messages: [text],
      });
  });

  it('«la zona tiene puntos» es un conflicto común con su texto', () => {
    expect(
      describeZoneError(
        api(409, 'La zona tiene puntos; muévelos o elimínalos antes.'),
      ),
    ).toMatchObject({
      kind: 'conflict',
      messages: ['La zona tiene puntos; muévelos o elimínalos antes.'],
    });
  });

  it('el 404 conserva el texto (punto o zona)', () => {
    expect(describeZoneError(api(404, 'Zona no encontrada.'))).toMatchObject({
      kind: 'missing',
      messages: ['Zona no encontrada.'],
    });
  });

  it('reparte los 400 por campo y deja el resto', () => {
    const e = describeZoneError(
      api(400, [
        'name must be between 1 and 80 characters',
        'hint must be between 1 and 200 characters',
        'floors must be an integer between 1 and 30',
        'zoneId must be a UUID',
        'Indica al menos un campo para editar.',
      ]),
    );
    expect(e.kind).toBe('validation');
    expect(e.fields.name).toMatch(/^name/);
    expect(e.fields.hint).toMatch(/^hint/);
    expect(e.fields.floors).toMatch(/^floors/);
    expect(e.fields.zoneId).toMatch(/^zoneId/);
    expect(e.messages).toEqual(['Indica al menos un campo para editar.']);
  });

  it('red caída y 5xx son ambiguos (se confirma consultando); otros errores, «other»', () => {
    expect(describeZoneError(api(0, 'x')).kind).toBe('ambiguous');
    expect(describeZoneError(api(500, 'x')).kind).toBe('ambiguous');
    expect(describeZoneError(api(403, 'x')).kind).toBe('other');
    expect(describeZoneError(new Error('x')).kind).toBe('other');
  });
});
