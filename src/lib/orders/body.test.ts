import { describe, expect, it } from 'vitest';
import { buildOrderBody, orderFingerprint } from './body';

const lines = [
  { productId: 'a', quantity: 2 },
  { productId: 'b', quantity: 1 },
];
const form = {
  pointId: 'p',
  floor: 2,
  deliveryNote: ' Junto a la puerta ',
  note: '',
};

describe('buildOrderBody', () => {
  it('arma el cuerpo y limpia la tarjeta', () => {
    expect(buildOrderBody(lines, form, '4242 4242 4242 4242')).toEqual({
      items: lines,
      pointId: 'p',
      floor: 2,
      deliveryNote: 'Junto a la puerta',
      payment: { method: 'tarjeta_demo', cardNumber: '4242424242424242' },
    });
  });
  it('omite piso nulo y notas vacías', () => {
    const body = buildOrderBody(
      lines,
      { ...form, floor: null, deliveryNote: '  ' },
      '4242424242424242',
    );
    expect(body).not.toHaveProperty('floor');
    expect(body).not.toHaveProperty('deliveryNote');
    expect(body).not.toHaveProperty('note');
  });
});

describe('orderFingerprint', () => {
  const base = buildOrderBody(lines, form, '4242424242424242');
  it('es igual con el mismo contenido sin importar el orden de los productos', () => {
    const swapped = buildOrderBody(
      [...lines].reverse(),
      form,
      '4242424242424242',
    );
    expect(orderFingerprint(swapped)).toBe(orderFingerprint(base));
  });
  it('cambia si cambia cualquier dato', () => {
    const f = orderFingerprint(base);
    expect(
      orderFingerprint(
        buildOrderBody(lines, { ...form, floor: 3 }, '4242424242424242'),
      ),
    ).not.toBe(f);
    expect(
      orderFingerprint(
        buildOrderBody(lines, { ...form, note: 'x' }, '4242424242424242'),
      ),
    ).not.toBe(f);
    expect(
      orderFingerprint(buildOrderBody(lines, form, '4000000000000002')),
    ).not.toBe(f);
    expect(
      orderFingerprint(
        buildOrderBody(
          [{ productId: 'a', quantity: 3 }],
          form,
          '4242424242424242',
        ),
      ),
    ).not.toBe(f);
  });
  it('no contiene el número completo de la tarjeta', () => {
    const f = orderFingerprint(base);
    expect(f).not.toContain('4242424242424242');
    expect(f).toContain('4242');
  });
});
