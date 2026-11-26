import { describe, expect, it } from 'vitest';
import { parseMovement, resultingStock, type MovementForm } from './movement';

const form = (o: Partial<MovementForm> = {}): MovementForm => ({
  type: 'IN',
  quantity: '10',
  reason: 'Compra a proveedor',
  ...o,
});

describe('parseMovement', () => {
  it('acepta un movimiento válido y recorta el motivo', () => {
    expect(parseMovement(form({ reason: '  Compra  ' }), 5)).toEqual({
      ok: true,
      value: { type: 'IN', quantity: 10, reason: 'Compra' },
    });
  });
  it('la cantidad debe ser un entero mayor que 0, sin signos, decimales ni ceros iniciales', () => {
    for (const bad of [
      '',
      ' ',
      '0',
      '-3',
      '1.5',
      '1,5',
      '03',
      'abc',
      '1e3',
      '1234567890',
    ]) {
      const r = parseMovement(form({ quantity: bad }), 5);
      expect(r.ok, bad).toBe(false);
    }
    expect(parseMovement(form({ quantity: '' }), 5)).toMatchObject({
      errors: { quantity: 'Escribe la cantidad.' },
    });
  });
  it('una salida no puede superar el saldo, una entrada sí', () => {
    expect(parseMovement(form({ type: 'OUT', quantity: '6' }), 5)).toEqual({
      ok: false,
      errors: { quantity: 'Hay 5; no puedes sacar 6.' },
    });
    expect(parseMovement(form({ type: 'OUT', quantity: '5' }), 5).ok).toBe(
      true,
    );
    expect(parseMovement(form({ type: 'IN', quantity: '999' }), 0).ok).toBe(
      true,
    );
  });
  it('el motivo es obligatorio, de hasta 300 caracteres y sin caracteres de control', () => {
    expect(parseMovement(form({ reason: '   ' }), 5).ok).toBe(false);
    expect(parseMovement(form({ reason: 'a'.repeat(300) }), 5).ok).toBe(true);
    expect(parseMovement(form({ reason: 'a'.repeat(301) }), 5)).toMatchObject({
      errors: { reason: 'El motivo admite hasta 300 caracteres.' },
    });
    expect(parseMovement(form({ reason: 'a\nb' }), 5).ok).toBe(false);
    expect(parseMovement(form({ reason: 'a\u0000b' }), 5).ok).toBe(false);
  });
  it('reporta los dos errores a la vez', () => {
    expect(parseMovement(form({ quantity: '', reason: '' }), 5)).toMatchObject({
      ok: false,
      errors: { quantity: expect.any(String), reason: expect.any(String) },
    });
  });
});

describe('resultingStock', () => {
  it('suma en entradas y resta en salidas', () => {
    expect(resultingStock('IN', 4, 10)).toBe(14);
    expect(resultingStock('OUT', 4, 10)).toBe(6);
  });
});
