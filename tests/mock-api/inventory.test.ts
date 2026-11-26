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

describe('escritura del catálogo en el mock (reglas del back)', () => {
  let items = buildMenu();
  let store = createInventoryStore(() => items);
  beforeEach(() => {
    items = buildMenu();
    store = createInventoryStore(() => items);
  });
  const pid = (sku: string) => items.find((p) => p.sku === sku)!.id;
  const msg = (r: { body: unknown }) =>
    (r.body as { message: string | string[] }).message;
  const simple = {
    sku: 'NEW-1',
    name: 'Nuevo',
    category: 'snack',
    price: 3000,
    cost: 1000,
  };

  it('crea un simple con saldo 0, activo, y lo valida', () => {
    const r = store.createProduct(simple);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({
      sku: 'NEW-1',
      stock: 0,
      active: true,
      cost: 1000,
      costPercent: 33.3,
      description: null,
      components: [],
    });
    expect(store.createProduct(simple).status).toBe(409);
    expect(msg(store.createProduct(simple))).toBe('El SKU ya existe.');
    expect(msg(store.createProduct({ ...simple, sku: 'x', price: 0 }))).toEqual(
      expect.arrayContaining([
        expect.stringContaining('sku'),
        expect.stringContaining('price'),
      ]),
    );
    expect(msg(store.createProduct({ ...simple, cost: undefined }))).toBe(
      'El costo es obligatorio.',
    );
  });

  it('crea un combo con precio por defecto = suma, costo calculado y reglas de componentes', () => {
    const base = {
      sku: 'CMB-NEW',
      name: 'Combo nuevo',
      category: 'combo',
      components: [
        { productId: pid('CAF-ESPR'), quantity: 2 },
        { productId: pid('PAN-PAND'), quantity: 1 },
      ],
    };
    const r = store.createProduct(base);
    expect(r.status).toBe(201);
    expect(r.body).toMatchObject({
      price: 8500,
      cost: Math.round(3000 * 0.35) * 2 + Math.round(2500 * 0.35),
    });
    expect(store.createProduct({ ...base, sku: 'C2', cost: 5 }).status).toBe(
      400,
    );
    expect(
      msg(
        store.createProduct({
          ...base,
          sku: 'C3',
          components: [base.components[0]],
        }),
      ),
    ).toBe('Un combo lleva entre 2 y 10 componentes.');
    expect(
      msg(
        store.createProduct({
          ...base,
          sku: 'C4',
          components: [base.components[0], base.components[0]],
        }),
      ),
    ).toBe('No repitas productos en la composición.');
    expect(
      msg(
        store.createProduct({
          ...base,
          sku: 'C5',
          components: [
            base.components[0],
            { productId: pid('CMB-CLAS'), quantity: 1 },
          ],
        }),
      ),
    ).toBe('El componente CMB-CLAS es un combo; un combo no contiene combos.');
    store.setStatus(pid('PAN-PAND'), { active: false });
    expect(msg(store.createProduct({ ...base, sku: 'C6' }))).toBe(
      'El componente PAN-PAND está inactivo.',
    );
  });

  it('edita sin tocar el precio del combo al recomponer; rechaza costo de combo y cambio de tipo', () => {
    const combo = pid('CMB-CLAS');
    expect(store.updateProduct(combo, { cost: 1 }).status).toBe(400);
    expect(msg(store.updateProduct(combo, { category: 'snack' }))).toBe(
      'Un producto no se convierte en combo ni a la inversa.',
    );
    expect(msg(store.updateProduct(combo, {}))).toBe(
      'Indica al menos un campo para editar.',
    );
    const r = store.replaceComponents(combo, {
      components: [
        { productId: pid('CAF-ESPR'), quantity: 1 },
        { productId: pid('PAS-BROW'), quantity: 3 },
      ],
    });
    expect(r.status).toBe(200);
    expect((r.body as { price: number }).price).toBe(6500);
    expect(
      store.replaceComponents(pid('CAF-ESPR'), { components: [] }).status,
    ).toBe(400);
    expect(
      msg(
        store.replaceComponents(pid('CAF-ESPR'), {
          components: [
            { productId: pid('CAF-AMER'), quantity: 1 },
            { productId: pid('CAF-LATT'), quantity: 1 },
          ],
        }),
      ),
    ).toBe('El producto no es un combo.');
    const edited = store.updateProduct(pid('CAF-ESPR'), {
      name: 'Espresso doble',
      description: null,
      cost: 900,
    });
    expect(edited.body).toMatchObject({
      name: 'Espresso doble',
      description: null,
      cost: 900,
    });
    expect(store.updateProduct('nope', { name: 'x' }).status).toBe(404);
  });

  it('eliminar: bloquea componentes y productos con movimientos; borra los libres', () => {
    expect(msg(store.removeProduct(pid('CAF-CAPU')))).toBe(
      'El producto es componente de un combo.',
    );
    store.createProduct(simple);
    const id = items.find((p) => p.sku === 'NEW-1')!.id;
    store.createMovement(USER, {
      productId: id,
      type: 'IN',
      quantity: 3,
      reason: 'entrada',
    });
    expect(msg(store.removeProduct(id))).toContain('tiene movimientos');
    store.createProduct({ ...simple, sku: 'NEW-2' });
    const free = items.find((p) => p.sku === 'NEW-2')!.id;
    expect(store.removeProduct(free).status).toBe(204);
    expect(store.removeProduct(free).status).toBe(404);
  });
});
