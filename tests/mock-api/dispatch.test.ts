import { describe, expect, it } from 'vitest';
import { createDispatchStore } from './dispatch.ts';
import { buildMenu } from './menu.ts';
import { buildZones, createOrderStore, POINT_ID } from './orders.ts';

const menu = buildMenu();
const capu = menu.find((p) => p.sku === 'CAF-CAPU')!;
const me = { id: 'c-1', name: 'Cliente Demo', phone: '+573001234567' };
const COURIER = 'u-repartidor';
let key = 0;

function setup() {
  const orders = createOrderStore(() => menu, buildZones);
  const dispatch = createDispatchStore(orders, buildZones);
  /** Crea un pedido y lo deja `listo`. */
  function ready(pointId: string) {
    key += 1;
    const created = orders.create(
      me,
      `8b1f6f8e-9a0c-4f3e-9d5e-${String(key).padStart(12, '0')}`,
      {
        items: [{ productId: capu.id, quantity: 1 }],
        pointId,
        payment: { method: 'tarjeta_demo', cardNumber: '4242424242424242' },
      },
    );
    const order = created.body as { id: string; number: number };
    orders.advance(order.id, 'listo');
    return order;
  }
  return { orders, dispatch, ready };
}
type Body = {
  statusCode?: number;
  message?: string | string[];
  zones?: { zoneName: string; orders: { number: number }[] }[];
  suggestedZoneId?: string | null;
  id?: string;
  status?: string;
  orders?: { number: number; status: string }[];
  data?: { id: string }[];
};
const b = (r: { body: unknown }) => r.body as Body;

describe('mock de despacho', () => {
  it('la cola agrupa por zona, la más antigua primero, y sugiere esa zona', () => {
    const s = setup();
    const z2 = s.ready(POINT_ID.cafeteria);
    const z1 = s.ready(POINT_ID.plazoleta);
    const r = s.dispatch.queue();
    expect(r.status).toBe(200);
    expect(b(r).zones?.map((z) => z.zoneName)).toEqual(['Zona 2', 'Zona 1']);
    expect(b(r).zones?.[0]?.orders[0]?.number).toBe(z2.number);
    expect(b(r).zones?.[1]?.orders[0]?.number).toBe(z1.number);
    expect(b(r).suggestedZoneId).toBe('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  });

  it('sin pedidos la cola va vacía y la sugerencia responde 409', () => {
    const s = setup();
    expect(b(s.dispatch.queue()).suggestedZoneId).toBeNull();
    const r = s.dispatch.createRound(COURIER, {});
    expect(r.status).toBe(409);
    expect(b(r).message).toBe('No hay pedidos listos para despachar.');
  });

  it('la sugerencia toma hasta 5 pedidos de la zona del más antiguo y los pone en camino', () => {
    const s = setup();
    for (let i = 0; i < 6; i += 1) s.ready(POINT_ID.plazoleta);
    s.ready(POINT_ID.cafeteria);
    const r = s.dispatch.createRound(COURIER, {});
    expect(r.status).toBe(201);
    expect(b(r).orders).toHaveLength(5);
    expect(b(r).orders?.every((o) => o.status === 'en_camino')).toBe(true);
    expect(b(s.dispatch.queue()).zones?.map((z) => z.orders.length)).toEqual([
      1, 1,
    ]);
  });

  it('una ruta propia valida los ids, el estado y la zona con los textos del back', () => {
    const s = setup();
    const a = s.ready(POINT_ID.plazoleta);
    const c = s.ready(POINT_ID.cafeteria);
    expect(s.dispatch.createRound(COURIER, { orderIds: [] }).status).toBe(400);
    expect(
      s.dispatch.createRound(COURIER, { orderIds: ['no-uuid'] }).status,
    ).toBe(400);
    const absent = s.dispatch.createRound(COURIER, {
      orderIds: ['11111111-2222-4333-8444-555555555555'],
    });
    expect(absent.status).toBe(404);
    expect(b(absent).message).toContain('Pedido no encontrado');
    const mixed = s.dispatch.createRound(COURIER, { orderIds: [a.id, c.id] });
    expect(mixed.status).toBe(409);
    // El orden de las zonas depende del orden de los ids (el back también ordena por id).
    expect(b(mixed).message).toMatch(
      /^Una ronda es de una sola zona; elegiste pedidos de: Zona [12], Zona [12]\.$/,
    );
    expect(s.dispatch.createRound(COURIER, { orderIds: [a.id] }).status).toBe(
      201,
    );
    const taken = s.dispatch.createRound(COURIER, { orderIds: [a.id] });
    expect(taken.status).toBe(409);
    expect(b(taken).message).toBe(
      `Los pedidos #${String(a.number)} ya no están en estado «listo».`,
    );
  });

  it('exige perfil completo y admite 2 rondas activas', () => {
    const s = setup();
    s.dispatch.setProfile({ fullName: null, phone: null });
    s.ready(POINT_ID.plazoleta);
    const incomplete = s.dispatch.createRound(COURIER, {});
    expect(incomplete.status).toBe(409);
    expect(b(incomplete).message).toBe(
      'Tu perfil de repartidor no tiene el nombre completo ni el teléfono; pídele al administrador que lo complete.',
    );
    s.dispatch.setProfile({ fullName: 'Carlos Gómez', phone: '+573001234500' });
    expect(s.dispatch.createRound(COURIER, {}).status).toBe(201);
    s.ready(POINT_ID.plazoleta);
    expect(s.dispatch.createRound(COURIER, {}).status).toBe(201);
    s.ready(POINT_ID.plazoleta);
    const third = s.dispatch.createRound(COURIER, {});
    expect(third.status).toBe(409);
    expect(b(third).message).toBe(
      'Ya tienes 2 rondas activas; termina una antes de salir con otra.',
    );
  });

  it('entregar y no entregar cierran el pedido y la ronda se cierra sola', () => {
    const s = setup();
    const o1 = s.ready(POINT_ID.plazoleta);
    const o2 = s.ready(POINT_ID.plazoleta);
    const round = b(s.dispatch.createRound(COURIER, {}));
    expect(s.dispatch.deliver(COURIER, o1.id).status).toBe(200);
    const again = s.dispatch.deliver(COURIER, o1.id);
    expect(again.status).toBe(409);
    expect(b(again).message).toBe(
      `El pedido #${String(o1.number)} está en estado «entregado»; solo uno «en_camino» se puede cerrar.`,
    );
    expect(s.dispatch.fail(COURIER, o2.id, { reason: '   ' }).status).toBe(400);
    expect(
      s.dispatch.fail(COURIER, o2.id, { reason: ' No estaba ' }).status,
    ).toBe(200);
    expect(s.orders.orders.find((o) => o.id === o2.id)?.failureReason).toBe(
      'No estaba',
    );
    expect(
      b(s.dispatch.listRounds(COURIER, new URLSearchParams())).data,
    ).toEqual([]);
    expect(b(s.dispatch.getRound(COURIER, round.id!)).status).toBe(
      'finalizada',
    );
  });

  it('una ronda ajena responde 404 y el control «foreign» hace tomar un pedido', () => {
    const s = setup();
    const o1 = s.ready(POINT_ID.plazoleta);
    expect(s.dispatch.foreign([o1.id]).status).toBe(204);
    expect(s.dispatch.deliver(COURIER, o1.id).status).toBe(404);
    const taken = s.dispatch.createRound(COURIER, { orderIds: [o1.id] });
    expect(taken.status).toBe(409);
    expect(s.dispatch.deliver(COURIER, 'no-uuid').status).toBe(400);
  });

  it('listAllRounds trae las rondas de todos los repartidores (todas si no hay filtro) y getAnyRound cualquiera', () => {
    const { orders, dispatch, ready } = setup();
    const a = ready(POINT_ID.plazoleta);
    const first = dispatch.createRound(COURIER, { orderIds: [a.id] }).body as {
      id: string;
    };
    const b = ready(POINT_ID.plazoleta);
    const second = dispatch.createRound('u-repartidor-2', {
      orderIds: [b.id],
    }).body as { id: string };
    const all = dispatch.listAllRounds(new URLSearchParams('')).body as {
      total: number;
      data: { id: string }[];
    };
    expect(all.total).toBe(2);
    expect(all.data.map((r) => r.id).sort()).toEqual(
      [first.id, second.id].sort(),
    );
    dispatch.deliver(COURIER, a.id);
    const done = dispatch.listAllRounds(
      new URLSearchParams('status=finalizada'),
    ).body as { total: number };
    expect(done.total).toBe(1);
    const active = dispatch.listAllRounds(new URLSearchParams('status=activa'))
      .body as { total: number };
    expect(active.total).toBe(1);
    expect(dispatch.listAllRounds(new URLSearchParams('status=x')).status).toBe(
      400,
    );
    expect(dispatch.getAnyRound(second.id).status).toBe(200);
    expect(dispatch.getAnyRound('no').status).toBe(400);
    expect(
      dispatch.getAnyRound('0b1f6f8e-9a0c-4f3e-9d5e-0a1b2c3d4e5f').status,
    ).toBe(404);
    void orders;
  });
});
