import { describe, expect, it } from 'vitest';
import { buildMenu } from './menu.ts';
import { buildZones, createOrderStore, POINT_ID } from './orders.ts';

const menu = buildMenu();
const capu = menu.find((p) => p.sku === 'CAF-CAPU')!;
const agotado = menu.find((p) => !p.available)!;
const me = { id: 'c-1', name: 'Cliente Demo', phone: '+573001234567' };
const KEY = '8b1f6f8e-9a0c-4f3e-9d5e-0a1b2c3d4e5f';

function store() {
  return createOrderStore(() => menu, buildZones);
}
const body = (over: Record<string, unknown> = {}) => ({
  items: [{ productId: capu.id, quantity: 2 }],
  pointId: POINT_ID.plazoleta,
  payment: { method: 'tarjeta_demo', cardNumber: '4242424242424242' },
  ...over,
});

describe('mock de pedidos', () => {
  it('crea un pedido con el total del menú (201) y la misma clave devuelve el mismo (200)', () => {
    const s = store();
    const first = s.create(me, KEY, body());
    expect(first.status).toBe(201);
    expect(first.body).toMatchObject({
      number: 1001,
      status: 'recibido',
      total: capu.price * 2,
    });
    const again = s.create(me, KEY, body());
    expect(again.status).toBe(200);
    expect((again.body as { id: string }).id).toBe(
      (first.body as { id: string }).id,
    );
    expect(s.orders).toHaveLength(1);
  });
  it('exige Idempotency-Key y valida el cuerpo', () => {
    const s = store();
    expect(s.create(me, undefined, body()).status).toBe(400);
    expect(s.create(me, KEY, body({ items: [] })).status).toBe(400);
    expect(
      s.create(
        me,
        KEY,
        body({ payment: { method: 'tarjeta_demo', cardNumber: '12' } }),
      ).status,
    ).toBe(400);
    expect(s.create(me, KEY, body({ note: '' })).status).toBe(400);
  });
  it('piso: obligatorio con pisos y prohibido sin pisos', () => {
    const s = store();
    expect(
      s.create(me, KEY, body({ pointId: POINT_ID.edificioA })).status,
    ).toBe(400);
    expect(s.create(me, KEY, body({ floor: 2 })).status).toBe(400);
    expect(
      s.create(me, KEY, body({ pointId: POINT_ID.edificioA, floor: 5 })).status,
    ).toBe(400);
    expect(
      s.create(me, KEY, body({ pointId: POINT_ID.edificioA, floor: 2 })).status,
    ).toBe(201);
  });
  it('402 tarjeta rechazada, 409 agotado, 404 punto o producto inexistente', () => {
    const s = store();
    expect(
      s.create(
        me,
        KEY,
        body({
          payment: { method: 'tarjeta_demo', cardNumber: '4000000000000002' },
        }),
      ).status,
    ).toBe(402);
    expect(
      s.create(
        me,
        KEY,
        body({ items: [{ productId: agotado.id, quantity: 1 }] }),
      ).status,
    ).toBe(409);
    expect(
      s.create(
        me,
        KEY,
        body({ pointId: '99999999-9999-4999-8999-999999999999' }),
      ).status,
    ).toBe(404);
    expect(
      s.create(me, KEY, body({ items: [{ productId: 'nada', quantity: 1 }] }))
        .status,
    ).toBe(404);
    expect(s.orders).toHaveLength(0);
  });
  it('lista solo los del cliente, paginados y del más reciente al más antiguo', () => {
    const s = store();
    for (let i = 0; i < 3; i++) s.create(me, crypto.randomUUID(), body());
    s.create({ ...me, id: 'c-2' }, crypto.randomUUID(), body());
    const page = s.list('c-1', 1, 2, null).body as {
      data: { number: number }[];
      total: number;
      totalPages: number;
    };
    expect(page.total).toBe(3);
    expect(page.totalPages).toBe(2);
    expect(page.data.map((o) => o.number)).toEqual([1003, 1002]);
  });
  it('un pedido ajeno es 404; cancelar solo en «recibido»', () => {
    const s = store();
    const created = s.create(me, KEY, body()).body as { id: string };
    expect(s.get('c-2', created.id).status).toBe(404);
    expect(s.cancel('c-2', created.id).status).toBe(404);
    const cancelled = s.cancel('c-1', created.id);
    expect(cancelled.status).toBe(200);
    expect(cancelled.body).toMatchObject({
      status: 'cancelado',
      payment: { status: 'reembolsado' },
    });
    expect(s.cancel('c-1', created.id).status).toBe(409);
  });
  it('advance cambia el estado y agrega repartidor y ETA en «en_camino»', () => {
    const s = store();
    const created = s.create(me, KEY, body()).body as { id: string };
    s.advance(created.id, 'en_camino');
    const order = s.get('c-1', created.id).body as {
      status: string;
      events: unknown[];
      delivery: { courier: unknown; etaAt: string };
    };
    expect(order.status).toBe('en_camino');
    expect(order.events).toHaveLength(2);
    expect(order.delivery.courier).toMatchObject({
      whatsappUrl: 'https://wa.me/573001234500',
    });
    expect(order.delivery.etaAt).toBeTruthy();
    expect(s.cancel('c-1', created.id).status).toBe(409);
  });
  it('avisa cada cambio (crear, avanzar, cancelar) con el dueño del pedido', () => {
    const seen: string[] = [];
    const s = createOrderStore(
      () => menu,
      buildZones,
      (customerId, order) =>
        seen.push(`${customerId}:${order.number}:${order.status}`),
    );
    const created = s.create(me, KEY, body()).body as { id: string };
    s.create(me, KEY, body()); // repetición con la misma clave: no es un cambio
    s.advance(created.id, 'en_preparacion');
    const other = s.create(me, '9c2f7a9f-1b1d-4a4f-8e6f-1b2c3d4e5f60', body())
      .body as { id: string };
    s.cancel('c-1', other.id);
    expect(seen).toEqual([
      'c-1:1001:recibido',
      'c-1:1001:en_preparacion',
      'c-1:1002:recibido',
      'c-1:1002:cancelado',
    ]);
  });
});
