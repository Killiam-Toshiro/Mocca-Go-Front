import { vi } from 'vitest';
import type { Round } from '@/lib/dispatch/types';
import type { Order } from '@/lib/orders/types';
import { kitchenOrder } from './kitchen';
import { jsonResponse } from './render';

export const ZONE = {
  z1: { id: 'zone-1', name: 'Zona 1' },
  z2: { id: 'zone-2', name: 'Zona 2' },
} as const;

type ZoneKey = keyof typeof ZONE;

/** Pedido `listo` (o del estado que se indique) de una zona. */
export function dispatchOrder(
  number: number,
  zone: ZoneKey = 'z1',
  over: Partial<Order> = {},
): Order & { zoneId: string } {
  const { delivery: deliveryOver, ...rest } = over;
  const base = kitchenOrder({
    number,
    status: 'listo',
    events: [
      { status: 'recibido', at: '2026-11-10T17:50:00.000Z' },
      { status: 'listo', at: '2026-11-10T18:00:00.000Z' },
    ],
    ...rest,
  });
  return {
    ...base,
    delivery: {
      ...base.delivery,
      zoneName: ZONE[zone].name,
      ...deliveryOver,
    },
    zoneId: ZONE[zone].id,
  };
}

export function backRound(over: Partial<Round> & { orders: Order[] }): Round {
  return {
    id: 'round-1',
    status: 'activa',
    zone: { id: ZONE.z1.id, name: ZONE.z1.name },
    courier: {
      id: 'u-repartidor',
      fullName: 'Carlos Gómez',
      phone: '+573001234500',
    },
    startedAt: '2026-11-10T18:10:00.000Z',
    etaAt: '2026-11-10T18:25:00.000Z',
    finishedAt: null,
    ...over,
  } as Round;
}

type Failure = number | 'network';

export interface DispatchBackOptions {
  /** Falla la creación de ronda (una vez, o siempre con `repeat`). */
  failCreate?: Failure;
  /** Con `failCreate: 'network'`, la ronda sí se creó en el back (la respuesta se perdió). */
  createStillHappens?: boolean;
  /** Falla el cierre de estos pedidos (por número). */
  failClose?: Record<number, Failure>;
  /** Con `failClose` en red, el cambio sí se registró en el back. */
  closeStillHappens?: boolean;
  /** Mensaje de un 409 al crear. */
  createMessage?: string;
}

/** Un back de despacho falso con estado: cola por zona, rondas activas, crear ronda y cerrar pedidos. */
export function fakeDispatchBack(
  ready: (Order & { zoneId: string })[],
  initialRounds: Round[] = [],
  opts: DispatchBackOptions = {},
) {
  const queue = ready.map((o) => ({ ...o }));
  const rounds = initialRounds.map((r) => ({
    ...r,
    orders: r.orders.map((o) => ({ ...o })),
  }));
  const calls: { method: string; url: string; body: unknown }[] = [];
  let failCreate = opts.failCreate;
  let seq = 0;

  function zones() {
    const groups = new Map<
      string,
      {
        zoneId: string;
        zoneName: string;
        oldestNumber: number;
        orders: Order[];
      }
    >();
    for (const o of [...queue].sort((a, b) => a.number - b.number)) {
      const g = groups.get(o.zoneId);
      if (g) g.orders.push(o);
      else
        groups.set(o.zoneId, {
          zoneId: o.zoneId,
          zoneName: o.delivery.zoneName,
          oldestNumber: o.number,
          orders: [o],
        });
    }
    return [...groups.values()];
  }

  function create(body: { orderIds?: string[] } | undefined): Round {
    const picked = body?.orderIds
      ? queue.filter((o) => body.orderIds?.includes(o.id))
      : queue.filter((o) => o.zoneId === zones()[0]?.zoneId).slice(0, 5);
    seq += 1;
    const round = backRound({
      id: `round-new-${String(seq)}`,
      zone: { id: picked[0]!.zoneId, name: picked[0]!.delivery.zoneName },
      orders: picked.map((o) => ({
        ...o,
        status: 'en_camino' as const,
      })) as Order[],
    });
    for (const o of picked) queue.splice(queue.indexOf(o), 1);
    rounds.unshift(round);
    return round;
  }

  function close(
    id: string,
    to: 'entregado' | 'no_entregado',
    reason?: string,
  ) {
    for (const round of rounds) {
      const order = round.orders.find((o) => o.id === id);
      if (!order) continue;
      order.status = to;
      if (reason) order.failureReason = reason;
      if (!round.orders.some((o) => o.status === 'en_camino')) {
        round.status = 'finalizada';
      }
      return order;
    }
    return null;
  }

  const f = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    const path = url.split('?')[0]!;

    if (method === 'GET' && path === '/api/dispatch/queue')
      return jsonResponse({
        suggestedZoneId: zones()[0]?.zoneId ?? null,
        zones: zones().map((z) => ({
          ...z,
        })),
      });

    if (method === 'GET' && path === '/api/dispatch/rounds') {
      const active = rounds.filter((r) => r.status === 'activa');
      return jsonResponse({
        page: 1,
        limit: 20,
        total: active.length,
        totalPages: 1,
        data: active,
      });
    }

    if (method === 'POST' && path === '/api/dispatch/rounds') {
      if (failCreate) {
        const failure = failCreate;
        failCreate = undefined;
        if (failure === 'network') {
          if (opts.createStillHappens) create(body);
          throw new TypeError('network');
        }
        return jsonResponse(
          { statusCode: failure, message: opts.createMessage ?? 'Error' },
          failure,
        );
      }
      return jsonResponse(create(body), 201);
    }

    const closeMatch =
      /^\/api\/dispatch\/orders\/([^/]+)\/(deliver|fail)$/.exec(path);
    if (method === 'POST' && closeMatch) {
      const id = closeMatch[1]!;
      const to = closeMatch[2] === 'deliver' ? 'entregado' : 'no_entregado';
      const target = rounds.flatMap((r) => r.orders).find((o) => o.id === id);
      const failure = target ? opts.failClose?.[target.number] : undefined;
      if (failure) {
        if (failure === 'network') {
          if (opts.closeStillHappens) close(id, to, body?.reason);
          throw new TypeError('network');
        }
        return jsonResponse({ statusCode: failure, message: 'Error' }, failure);
      }
      if (!target || target.status !== 'en_camino')
        return jsonResponse(
          { statusCode: 409, message: 'El pedido no está «en_camino»' },
          409,
        );
      return jsonResponse(close(id, to, body?.reason));
    }
    return jsonResponse({ statusCode: 404, message: 'x' }, 404);
  });

  vi.stubGlobal('fetch', f);
  return {
    calls,
    queue,
    rounds,
    posts: () => calls.filter((c) => c.method === 'POST'),
  };
}
