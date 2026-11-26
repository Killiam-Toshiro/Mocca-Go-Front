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
  describe('cocina', () => {
    const second = { id: 'c-2', name: 'Otra Persona', phone: '+573009998877' };

    it('lista los pedidos de todos los clientes, el más antiguo primero, y filtra por estado', () => {
      const s = store();
      const a = s.create(me, KEY, body()).body as { id: string };
      s.create(second, '9c2f7a9f-1b1d-4a4f-8e6f-1b2c3d4e5f60', body());
      s.kitchenStart(a.id);
      const all = s.listKitchen(['recibido', 'en_preparacion'], 1, 20).body as {
        total: number;
        data: { number: number }[];
      };
      expect(all.data.map((o) => o.number)).toEqual([1001, 1002]);
      const prep = s.listKitchen(['en_preparacion'], 1, 20).body as {
        data: { number: number }[];
      };
      expect(prep.data.map((o) => o.number)).toEqual([1001]);
      expect(
        (s.listKitchen(['listo'], 1, 20).body as { total: number }).total,
      ).toBe(0);
    });

    it('empezar y listo respetan el orden de estados (409 si no corresponde, 404 si no existe)', () => {
      const s = store();
      const { id } = s.create(me, KEY, body()).body as { id: string };
      expect(s.kitchenReady(id).status).toBe(409);
      expect(s.kitchenStart(id).status).toBe(200);
      expect(s.kitchenStart(id).status).toBe(409);
      expect(s.kitchenReady(id).status).toBe(200);
      expect(s.kitchenReady(id).status).toBe(409);
      expect(
        s.kitchenStart('4b1f6f8e-9a0c-4f3e-9d5e-0a1b2c3d4e5f').status,
      ).toBe(404);
    });

    it('el personal cancela con motivo en recibido o en preparación, no después', () => {
      const s = store();
      const { id } = s.create(me, KEY, body()).body as { id: string };
      expect(s.cancelStaff(id, '').status).toBe(400);
      expect(s.cancelStaff(id, 'x'.repeat(201)).status).toBe(400);
      s.kitchenStart(id);
      const done = s.cancelStaff(id, 'Se acabó el café');
      expect(done.status).toBe(200);
      expect(done.body).toMatchObject({
        status: 'cancelado',
        cancelReason: 'Se acabó el café',
        payment: { status: 'reembolsado' },
      });
      expect(s.cancelStaff(id, 'otra vez').status).toBe(409);

      const next = s.create(me, '9c2f7a9f-1b1d-4a4f-8e6f-1b2c3d4e5f61', body())
        .body as { id: string };
      s.kitchenStart(next.id);
      s.kitchenReady(next.id);
      expect(s.cancelStaff(next.id, 'tarde').status).toBe(409);
    });
  });

  describe('encuesta', () => {
    function delivered() {
      const s = store();
      const created = s.create(me, KEY, body()).body as { id: string };
      return { s, id: created.id };
    }
    it('solo con el pedido entregado, una vez, con los textos del back', () => {
      const { s, id } = delivered();
      expect(s.survey('c-1', id, { rating: 5 })).toMatchObject({
        status: 409,
        body: {
          message:
            'El pedido #1001 está en estado «recibido»; la encuesta se responde cuando está «entregado».',
        },
      });
      s.advance(id, 'entregado');
      const first = s.survey('c-1', id, { rating: 4, comment: '  Rico  ' });
      expect(first).toMatchObject({
        status: 201,
        body: { orderId: id, rating: 4, comment: 'Rico' },
      });
      expect(s.get('c-1', id).body).toMatchObject({ survey: { rating: 4 } });
      expect(s.survey('c-1', id, { rating: 5 })).toMatchObject({
        status: 409,
        body: { message: 'Este pedido ya tiene una respuesta de la encuesta.' },
      });
    });
    it('valida y no deja calificar pedidos ajenos', () => {
      const { s, id } = delivered();
      s.advance(id, 'entregado');
      expect(s.survey('c-1', id, { rating: 6 }).status).toBe(400);
      expect(s.survey('c-1', id, { rating: 3, comment: '   ' }).status).toBe(
        400,
      );
      expect(
        s.survey('c-1', id, { rating: 3, comment: 'x'.repeat(301) }).status,
      ).toBe(400);
      expect(s.survey('c-2', id, { rating: 3 })).toMatchObject({
        status: 404,
        body: { message: 'Pedido no encontrado.' },
      });
    });
  });

  describe('pedidos del personal (007d)', () => {
    it('listAll trae los pedidos de todos los clientes, el más reciente primero, con filtro y validación', () => {
      const s = store();
      const a = s.create(me, KEY, body()).body as { id: string };
      const other = { id: 'c-2', name: 'Otra Persona', phone: '+573009998877' };
      s.create(other, '9c2f7a9f-1b1d-4a4f-8e6f-1b2c3d4e5f60', body());
      s.kitchenStart(a.id);
      const all = s.listAll(1, 20, null).body as {
        total: number;
        data: { number: number; customer: { name: string } }[];
      };
      expect(all.total).toBe(2);
      expect(all.data.map((o) => o.number)).toEqual([1002, 1001]);
      expect(all.data[0]?.customer.name).toBe('Otra Persona');
      const prep = s.listAll(1, 20, 'en_preparacion').body as { total: number };
      expect(prep.total).toBe(1);
      expect(s.listAll(1, 20, 'raro').status).toBe(400);
      expect(s.listAll(0, 20, null).status).toBe(400);
      expect(s.listAll(1, 101, null).status).toBe(400);
    });

    it('getAny devuelve cualquier pedido; 400 si no es UUID y 404 si no existe', () => {
      const s = store();
      const a = s.create(me, KEY, body()).body as { id: string };
      expect(s.getAny(a.id).status).toBe(200);
      expect(s.getAny('x').status).toBe(400);
      const missing = s.getAny('0b1f6f8e-9a0c-4f3e-9d5e-0a1b2c3d4e5f');
      expect(missing.status).toBe(404);
      expect((missing.body as { message: string }).message).toBe(
        'Pedido no encontrado.',
      );
    });

    it('cancelStaff usa los textos del back: sin motivo, 404 y estado en el 409', () => {
      const s = store();
      const a = s.create(me, KEY, body()).body as { id: string };
      expect(
        (s.cancelStaff(a.id, undefined).body as { message: string }).message,
      ).toBe('Indica el motivo de la cancelación.');
      s.advance(a.id, 'listo');
      expect(
        (s.cancelStaff(a.id, 'x').body as { message: string }).message,
      ).toBe('El pedido no se puede cancelar en estado «listo».');
    });
  });
});
