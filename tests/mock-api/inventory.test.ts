import { beforeEach, describe, expect, it } from 'vitest';
import { createInventoryStore } from './inventory.ts';
import { buildMenu } from './menu.ts';

const USER = { id: 'u-operador', username: 'operador' };
const menu = buildMenu();
const id = (sku: string) => menu.find((p) => p.sku === sku)!.id;

describe('almacén de inventario del mock', () => {
  let store = createInventoryStore(() => menu);
  beforeEach(() => {
    store = createInventoryStore(() => menu);
  });

  it('lista el catálogo ordenado por SKU, con costo, y filtra por búsqueda y categoría', () => {
    const all = store.listProducts(new URLSearchParams('limit=100'));
    const data = (all.body as { data: { sku: string; cost: number }[] }).data;
    expect(data.map((p) => p.sku)).toEqual(
      [...data.map((p) => p.sku)].sort((a, b) => a.localeCompare(b)),
    );
    expect(data[0]?.cost).toBeGreaterThan(0);
    const found = store.listProducts(new URLSearchParams('search=CAPU'));
    expect((found.body as { total: number }).total).toBe(1);
    const accent = store.listProducts(new URLSearchParams('search=te%20chai'));
    expect((accent.body as { total: number }).total).toBe(1);
    const combos = store.listProducts(new URLSearchParams('category=combo'));
    expect((combos.body as { total: number }).total).toBe(3);
    expect(store.listProducts(new URLSearchParams('limit=0')).status).toBe(400);
  });

  it('agotar deja el producto no disponible en el menú; volver a vender lo recupera', () => {
    const sku = 'CAF-ESPR';
    const r = store.setSoldOut(id(sku), { soldOut: true });
    expect(r.status).toBe(200);
    expect((r.body as { soldOut: boolean; available: boolean }).available).toBe(
      false,
    );
    expect(store.menu().find((p) => p.sku === sku)?.available).toBe(false);
    store.setSoldOut(id(sku), { soldOut: false });
    expect(store.menu().find((p) => p.sku === sku)?.available).toBe(true);
    expect(store.setSoldOut(id(sku), { soldOut: 'sí' }).status).toBe(400);
    expect(store.setSoldOut('prod-nada', { soldOut: true }).status).toBe(404);
  });

  it('una entrada suma y una salida resta; responde el saldo y guarda el movimiento', () => {
    const base = { productId: id('CAF-AMER'), reason: 'Compra a proveedor' };
    const entry = store.createMovement(USER, {
      ...base,
      type: 'IN',
      quantity: 10,
    });
    expect(entry.status).toBe(201);
    expect((entry.body as { stock: number }).stock).toBe(60);
    const out = store.createMovement(USER, {
      ...base,
      type: 'OUT',
      quantity: 5,
      reason: '  Merma  ',
    });
    expect(
      (out.body as { stock: number; movement: { reason: string } }).stock,
    ).toBe(55);
    expect((out.body as { movement: { reason: string } }).movement.reason).toBe(
      'Merma',
    );
    const list = store.listMovements(new URLSearchParams());
    const rows = (list.body as { data: { type: string }[] }).data;
    expect(rows.map((m) => m.type)).toEqual(['OUT', 'IN']);
    expect(
      (
        store.listMovements(new URLSearchParams('type=IN')).body as {
          total: number;
        }
      ).total,
    ).toBe(1);
  });

  it('rechaza datos inválidos (400), producto inexistente (404) y saldo insuficiente, combo o inactivo (409)', () => {
    const ok = {
      productId: id('CAF-AMER'),
      type: 'IN',
      quantity: 1,
      reason: 'x',
    };
    expect(store.createMovement(USER, { ...ok, quantity: 1.5 }).status).toBe(
      400,
    );
    expect(store.createMovement(USER, { ...ok, quantity: '3' }).status).toBe(
      400,
    );
    expect(store.createMovement(USER, { ...ok, reason: '   ' }).status).toBe(
      400,
    );
    expect(store.createMovement(USER, { ...ok, type: 'XX' }).status).toBe(400);
    expect(
      store.createMovement(USER, { ...ok, productId: 'prod-nada' }).status,
    ).toBe(404);
    expect(
      store.createMovement(USER, { ...ok, type: 'OUT', quantity: 51 }).status,
    ).toBe(409);
    expect(
      store.createMovement(USER, { ...ok, productId: id('CMB-CLAS') }).status,
    ).toBe(409);
    store.setActive('CAF-AMER', false);
    expect(store.createMovement(USER, ok).status).toBe(409);
  });

  it('el saldo de un combo sale de sus componentes y sin saldo no está disponible', () => {
    const combo = () =>
      (
        store.listProducts(new URLSearchParams('search=CMB-CLAS')).body as {
          data: { stock: number; available: boolean }[];
        }
      ).data[0]!;
    expect(combo().stock).toBe(50);
    store.setStock('CAF-CAPU', 0);
    expect(combo().stock).toBe(0);
    expect(combo().available).toBe(false);
    expect(store.menu().find((p) => p.sku === 'CMB-CLAS')?.available).toBe(
      false,
    );
  });
});
