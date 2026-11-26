import { describe, expect, it } from 'vitest';
import type { MenuItem } from '@/lib/menu/categories';
import {
  acknowledgePrices,
  addLine,
  CART_VERSION,
  EMPTY_CART,
  MAX_LINES,
  MAX_QUANTITY,
  parseCart,
  pruneRetired,
  reconcile,
  removeLine,
  serializeCart,
  setQuantity,
  type Cart,
} from './cart';

const product = (id: string, price = 4500, name = `P-${id}`) => ({
  id,
  name,
  price,
});
const menuItem = (id: string, price: number, available = true): MenuItem =>
  ({
    id,
    sku: id.toUpperCase(),
    name: `P-${id}`,
    description: null,
    category: 'cafe',
    price,
    available,
    components: [],
  }) as MenuItem;

describe('addLine', () => {
  it('agrega un producto nuevo con su nombre y último precio', () => {
    const r = addLine(EMPTY_CART, product('a', 4500, 'Capuchino'), 2);
    expect(r.status).toBe('added');
    expect(r.cart).toEqual([
      { productId: 'a', name: 'Capuchino', quantity: 2, seenPrice: 4500 },
    ]);
  });

  it('suma a una línea existente', () => {
    const first = addLine(EMPTY_CART, product('a'), 2).cart;
    const r = addLine(first, product('a'), 3);
    expect(r.status).toBe('increased');
    expect(r.cart[0]!.quantity).toBe(5);
  });

  it('no se pasa de 10 unidades: no cambia nada y avisa', () => {
    const full = addLine(EMPTY_CART, product('a'), MAX_QUANTITY).cart;
    const r = addLine(full, product('a'), 1);
    expect(r.status).toBe('max-quantity');
    expect(r.cart).toBe(full);
    expect(addLine(EMPTY_CART, product('a'), 11).status).toBe('max-quantity');
  });

  it('no pasa de 10 productos distintos', () => {
    let cart: Cart = EMPTY_CART;
    for (let i = 0; i < MAX_LINES; i += 1)
      cart = addLine(cart, product(`p${i}`)).cart;
    const r = addLine(cart, product('otro'));
    expect(r.status).toBe('max-lines');
    expect(r.cart).toBe(cart);
    // Pero sí se puede subir la cantidad de uno que ya está.
    expect(addLine(cart, product('p0')).status).toBe('increased');
  });

  it('cantidades inválidas no agregan', () => {
    expect(addLine(EMPTY_CART, product('a'), 0).cart).toBe(EMPTY_CART);
    expect(addLine(EMPTY_CART, product('a'), -3).cart).toBe(EMPTY_CART);
    expect(addLine(EMPTY_CART, product('a'), Number.NaN).cart).toBe(EMPTY_CART);
  });
});

describe('setQuantity y removeLine', () => {
  const cart = addLine(
    addLine(EMPTY_CART, product('a'), 2).cart,
    product('b'),
  ).cart;

  it('fija la cantidad y la limita a 10', () => {
    expect(setQuantity(cart, 'a', 4)[0]!.quantity).toBe(4);
    expect(setQuantity(cart, 'a', 99)[0]!.quantity).toBe(MAX_QUANTITY);
  });

  it('con 0 o menos quita la línea', () => {
    expect(setQuantity(cart, 'a', 0).map((l) => l.productId)).toEqual(['b']);
    expect(setQuantity(cart, 'a', -1)).toHaveLength(1);
  });

  it('quita una línea y no toca las demás', () => {
    expect(removeLine(cart, 'b').map((l) => l.productId)).toEqual(['a']);
    expect(removeLine(cart, 'zzz')).toHaveLength(2);
  });
});

describe('parseCart / serializeCart', () => {
  const line = { productId: 'a', name: 'A', quantity: 2, seenPrice: 4500 };

  it('ida y vuelta', () => {
    const cart: Cart = [line];
    expect(parseCart(serializeCart(cart))).toEqual(cart);
  });

  it.each([
    ['vacío', ''],
    ['null', null],
    ['no es JSON', '{no'],
    ['no es un objeto', '[1,2]'],
    ['otra versión', JSON.stringify({ v: CART_VERSION + 1, lines: [line] })],
    ['sin líneas', JSON.stringify({ v: CART_VERSION })],
    [
      'cantidad 0',
      JSON.stringify({ v: CART_VERSION, lines: [{ ...line, quantity: 0 }] }),
    ],
    [
      'cantidad 11',
      JSON.stringify({ v: CART_VERSION, lines: [{ ...line, quantity: 11 }] }),
    ],
    [
      'cantidad decimal',
      JSON.stringify({ v: CART_VERSION, lines: [{ ...line, quantity: 1.5 }] }),
    ],
    [
      'precio negativo',
      JSON.stringify({ v: CART_VERSION, lines: [{ ...line, seenPrice: -1 }] }),
    ],
    [
      'sin nombre',
      JSON.stringify({ v: CART_VERSION, lines: [{ ...line, name: '' }] }),
    ],
    [
      'productos repetidos',
      JSON.stringify({ v: CART_VERSION, lines: [line, line] }),
    ],
    [
      'más de 10 líneas',
      JSON.stringify({
        v: CART_VERSION,
        lines: Array.from({ length: 11 }, (_, i) => ({
          ...line,
          productId: `p${i}`,
        })),
      }),
    ],
  ])('descarta un carrito inválido (%s)', (_name, raw) => {
    expect(parseCart(raw)).toEqual([]);
  });
});

describe('reconcile', () => {
  const cart = [
    { productId: 'a', name: 'A', quantity: 2, seenPrice: 4500 },
    { productId: 'b', name: 'B', quantity: 1, seenPrice: 3000 },
    { productId: 'c', name: 'C', quantity: 3, seenPrice: 2000 },
    { productId: 'd', name: 'D', quantity: 1, seenPrice: 5000 },
  ] satisfies Cart;
  const menu = [
    menuItem('a', 4500),
    menuItem('b', 3500), // cambió de precio
    menuItem('c', 2000, false), // agotado
    // 'd' ya no está en el menú
  ];

  it('marca cada línea y suma solo lo disponible', () => {
    const r = reconcile(cart, menu);
    expect(r.rows.map((row) => row.status)).toEqual([
      'ok',
      'ok',
      'agotado',
      'retirado',
    ]);
    expect(r.rows[1]).toMatchObject({ priceChanged: true, unitPrice: 3500 });
    expect(r.subtotal).toBe(2 * 4500 + 1 * 3500);
    expect(r.units).toBe(7);
    expect(r.unavailableCount).toBe(2);
    expect(r.priceChangedCount).toBe(1);
    expect(r.canContinue).toBe(false);
  });

  it('con todo disponible se puede continuar', () => {
    const r = reconcile(cart.slice(0, 1), menu);
    expect(r).toMatchObject({ subtotal: 9000, canContinue: true });
  });

  it('un carrito vacío no puede continuar', () => {
    expect(reconcile(EMPTY_CART, menu)).toMatchObject({
      units: 0,
      subtotal: 0,
      canContinue: false,
    });
  });

  it('sin menú (cargando o con error) todo queda pendiente y no se puede continuar', () => {
    const r = reconcile(cart, undefined);
    expect(r.rows.every((row) => row.status === 'pendiente')).toBe(true);
    expect(r.subtotal).toBe(0);
    expect(r.canContinue).toBe(false);
    expect(r.rows[0]!.unitPrice).toBe(4500);
  });

  it('el total es exacto con precios y cantidades variados', () => {
    const lines: Cart = [
      { productId: 'x', name: 'X', quantity: 10, seenPrice: 3800 },
      { productId: 'y', name: 'Y', quantity: 7, seenPrice: 8500 },
      { productId: 'z', name: 'Z', quantity: 3, seenPrice: 2500 },
    ];
    const r = reconcile(lines, [
      menuItem('x', 3800),
      menuItem('y', 8500),
      menuItem('z', 2500),
    ]);
    expect(r.subtotal).toBe(38000 + 59500 + 7500);
  });
});

describe('pruneRetired y acknowledgePrices', () => {
  const cart: Cart = [
    { productId: 'a', name: 'A', quantity: 1, seenPrice: 1000 },
    { productId: 'b', name: 'B', quantity: 1, seenPrice: 2000 },
  ];

  it('quita lo que ya no está y lo devuelve', () => {
    const r = pruneRetired(cart, [menuItem('a', 1000)]);
    expect(r.cart.map((l) => l.productId)).toEqual(['a']);
    expect(r.removed.map((l) => l.name)).toEqual(['B']);
  });

  it('si no hay retirados devuelve el mismo carrito', () => {
    const r = pruneRetired(cart, [menuItem('a', 1000), menuItem('b', 2000)]);
    expect(r.cart).toBe(cart);
    expect(r.removed).toEqual([]);
  });

  it('«Entendido» iguala el precio visto al vigente', () => {
    const next = acknowledgePrices(cart, [
      menuItem('a', 1200),
      menuItem('b', 2000),
    ]);
    expect(next[0]!.seenPrice).toBe(1200);
    expect(next[1]).toBe(cart[1]);
    expect(acknowledgePrices(cart, [menuItem('a', 1000)])).toBe(cart);
  });
});
