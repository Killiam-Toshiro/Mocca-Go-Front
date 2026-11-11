import { randomUUID } from 'node:crypto';
import type {
  MockOrder,
  MockZone,
  OrderResult,
  OrderStatus,
} from './orders.ts';

export const MAX_ROUND_ORDERS = 5;
export const MAX_ACTIVE_ROUNDS = 2;
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface MockRound {
  id: string;
  status: 'activa' | 'finalizada';
  zone: { id: string; name: string };
  courier: { id: string; fullName: string | null; phone: string | null };
  startedAt: string;
  etaAt: string;
  finishedAt: string | null;
  orders: MockOrder[];
}

export interface Profile {
  fullName: string | null;
  phone: string | null;
}

const ok = (status: number, body: unknown): OrderResult => ({ status, body });
const err = (status: number, message: string | string[]): OrderResult => ({
  status,
  body: { statusCode: status, message, error: 'Error' },
});

/** Lo que el almacén de pedidos le presta al despacho. */
export interface OrderAccess {
  orders: MockOrder[];
  setStatus(order: MockOrder, status: OrderStatus): void;
  notify(order: MockOrder): void;
}

/**
 * Despacho de prueba con los textos de error y las reglas del back real
 * (`dispatch.service.ts`, verificado el 2026-11-10; ver plan 005, Anexo A).
 */
export function createDispatchStore(
  access: OrderAccess,
  zones: () => MockZone[],
) {
  const rounds: MockRound[] = [];
  const roundOf = new Map<string, string>();
  const OWN = 'u-repartidor';
  const FULL: Record<string, Profile> = {
    'u-repartidor': { fullName: 'Carlos Gómez', phone: '+573001234500' },
    'u-repartidor-2': { fullName: 'Laura Ríos', phone: '+573001234501' },
  };
  const profiles = new Map<string, Profile>();
  const profileOf = (courierId: string): Profile =>
    profiles.get(courierId) ?? { ...(FULL[courierId] ?? FULL[OWN]!) };
  /** Para aislar las pruebas E2E en paralelo: cada repartidor puede ver solo ciertos pedidos. */
  const scopes = new Map<string, Set<string>>();

  function zoneOf(order: MockOrder): { id: string; name: string } {
    for (const zone of zones())
      if (zone.points.some((p) => p.id === order.delivery.pointId))
        return { id: zone.id, name: zone.name };
    return { id: 'sin-zona', name: order.delivery.zoneName };
  }

  const ready = (courierId: string) =>
    access.orders
      .filter((o) => o.status === 'listo')
      .filter((o) => !scopes.has(courierId) || scopes.get(courierId)?.has(o.id))
      .sort((a, b) => a.number - b.number);

  function queue(courierId = OWN): OrderResult {
    const byZone = new Map<
      string,
      {
        zoneId: string;
        zoneName: string;
        oldestNumber: number;
        orders: MockOrder[];
      }
    >();
    for (const order of ready(courierId)) {
      const zone = zoneOf(order);
      const group = byZone.get(zone.id);
      if (group) group.orders.push(order);
      else
        byZone.set(zone.id, {
          zoneId: zone.id,
          zoneName: zone.name,
          oldestNumber: order.number,
          orders: [order],
        });
    }
    const list = [...byZone.values()];
    return ok(200, { suggestedZoneId: list[0]?.zoneId ?? null, zones: list });
  }

  function view(round: MockRound) {
    return {
      ...round,
      courier: { ...round.courier },
      orders: round.orders,
    };
  }

  function createRound(
    courierId: string,
    body: Record<string, unknown> | null,
  ): OrderResult {
    if (!body) return err(400, ['El cuerpo debe ser un objeto JSON']);
    const ids = body.orderIds;
    if (ids !== undefined) {
      if (
        !Array.isArray(ids) ||
        ids.length < 1 ||
        ids.length > MAX_ROUND_ORDERS ||
        new Set(ids).size !== ids.length ||
        !ids.every((id) => typeof id === 'string' && UUID_V4.test(id))
      )
        return err(400, [
          'orderIds debe tener de 1 a 5 identificadores UUID únicos',
        ]);
    }
    const profile = profileOf(courierId);
    const missing = [
      profile.fullName ? null : 'el nombre completo',
      profile.phone ? null : 'el teléfono',
    ].filter(Boolean);
    if (missing.length > 0)
      return err(
        409,
        `Tu perfil de repartidor no tiene ${missing.join(' ni ')}; pídele al administrador que lo complete.`,
      );
    const active = rounds.filter(
      (r) => r.courier.id === courierId && r.status === 'activa',
    ).length;
    if (active >= MAX_ACTIVE_ROUNDS)
      return err(
        409,
        `Ya tienes ${String(MAX_ACTIVE_ROUNDS)} rondas activas; termina una antes de salir con otra.`,
      );

    let picked: MockOrder[];
    if (ids) {
      const wanted = [...(ids as string[])].sort();
      const found = wanted.map((id) => access.orders.find((o) => o.id === id));
      const absent = wanted.filter((_, i) => !found[i]);
      if (absent.length > 0)
        return err(404, `Pedido no encontrado: ${absent.join(', ')}.`);
      picked = found as MockOrder[];
      const notReady = picked.filter((o) => o.status !== 'listo');
      if (notReady.length > 0)
        return err(
          409,
          `Los pedidos ${notReady.map((o) => `#${String(o.number)}`).join(', ')} ya no están en estado «listo».`,
        );
      const zoneIds = new Set(picked.map((o) => zoneOf(o).id));
      if (zoneIds.size > 1)
        return err(
          409,
          `Una ronda es de una sola zona; elegiste pedidos de: ${[...new Set(picked.map((o) => zoneOf(o).name))].join(', ')}.`,
        );
    } else {
      const first = ready(courierId)[0];
      if (!first) return err(409, 'No hay pedidos listos para despachar.');
      const zone = zoneOf(first).id;
      picked = ready(courierId)
        .filter((o) => zoneOf(o).id === zone)
        .slice(0, MAX_ROUND_ORDERS);
    }

    const zone = zoneOf(picked[0]!);
    const startedAt = new Date();
    const etaAt = new Date(startedAt.getTime() + 15 * 60_000).toISOString();
    const round: MockRound = {
      id: randomUUID(),
      status: 'activa',
      zone,
      courier: {
        id: courierId,
        fullName: profile.fullName,
        phone: profile.phone,
      },
      startedAt: startedAt.toISOString(),
      etaAt,
      finishedAt: null,
      orders: picked,
    };
    rounds.push(round);
    const digits = (profile.phone ?? '').replace(/^\+/, '');
    for (const order of picked) {
      access.setStatus(order, 'en_camino');
      order.delivery.etaAt = etaAt;
      order.delivery.courier = {
        fullName: profile.fullName ?? '',
        phone: profile.phone ?? '',
        whatsappUrl: `https://wa.me/${digits}`,
      };
      roundOf.set(order.id, round.id);
      access.notify(order);
    }
    return ok(201, view(round));
  }

  function listRounds(courierId: string, params: URLSearchParams): OrderResult {
    const status = params.get('status') ?? 'activa';
    if (status !== 'activa' && status !== 'finalizada')
      return err(400, ['status inválido']);
    const page = Number(params.get('page') ?? 1);
    const limit = Number(params.get('limit') ?? 20);
    const all = rounds
      .filter((r) => r.courier.id === courierId && r.status === status)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    const start = (page - 1) * limit;
    return ok(200, {
      page,
      limit,
      total: all.length,
      totalPages: Math.ceil(all.length / limit),
      data: all.slice(start, start + limit).map(view),
    });
  }

  function getRound(courierId: string, id: string): OrderResult {
    if (!UUID_V4.test(id)) return err(400, ['id debe ser un UUID']);
    const round = rounds.find((r) => r.id === id && r.courier.id === courierId);
    return round ? ok(200, view(round)) : err(404, 'Ronda no encontrada.');
  }

  function close(
    courierId: string,
    id: string,
    to: 'entregado' | 'no_entregado',
    body: Record<string, unknown> | null,
  ): OrderResult {
    if (!UUID_V4.test(id)) return err(400, ['id debe ser un UUID']);
    let reason: string | null = null;
    if (to === 'no_entregado') {
      const raw = body?.reason;
      if (
        typeof raw !== 'string' ||
        raw.length < 1 ||
        raw.length > 200 ||
        !/\S/.test(raw)
      )
        return err(400, ['reason debe tener entre 1 y 200 caracteres']);
      reason = raw.trim();
    }
    const order = access.orders.find((o) => o.id === id);
    const round = rounds.find((r) => r.id === roundOf.get(id));
    if (!order || !round || round.courier.id !== courierId)
      return err(404, 'Pedido no encontrado.');
    if (order.status !== 'en_camino')
      return err(
        409,
        `El pedido #${String(order.number)} está en estado «${order.status}»; solo uno «en_camino» se puede cerrar.`,
      );
    access.setStatus(order, to);
    if (reason) order.failureReason = reason;
    access.notify(order);
    if (!round.orders.some((o) => o.status === 'en_camino')) {
      round.status = 'finalizada';
      round.finishedAt = new Date().toISOString();
    }
    return ok(200, order);
  }

  /** Control: otro repartidor se lleva estos pedidos (quedan `en_camino` en una ronda ajena). */
  function foreign(ids: string[]): OrderResult {
    const picked = ids
      .map((id) => access.orders.find((o) => o.id === id))
      .filter((o): o is MockOrder => !!o);
    if (picked.length === 0) return err(404, 'Pedido no encontrado');
    const startedAt = new Date().toISOString();
    const round: MockRound = {
      id: randomUUID(),
      status: 'activa',
      zone: zoneOf(picked[0]!),
      courier: {
        id: 'u-otro',
        fullName: 'Otro Repartidor',
        phone: '+573009999999',
      },
      startedAt,
      etaAt: new Date(Date.now() + 15 * 60_000).toISOString(),
      finishedAt: null,
      orders: picked,
    };
    rounds.push(round);
    for (const order of picked) {
      access.setStatus(order, 'en_camino');
      roundOf.set(order.id, round.id);
      access.notify(order);
    }
    return ok(204, undefined);
  }

  return {
    queue,
    createRound,
    listRounds,
    getRound,
    deliver: (courierId: string, id: string) =>
      close(courierId, id, 'entregado', null),
    fail: (
      courierId: string,
      id: string,
      body: Record<string, unknown> | null,
    ) => close(courierId, id, 'no_entregado', body),
    foreign,
    setProfile(change: Partial<Profile>, courierId = OWN) {
      profiles.set(courierId, { ...profileOf(courierId), ...change });
    },
    /** Control: vuelve al perfil completo de ese repartidor. */
    restoreProfile(courierId = OWN) {
      profiles.delete(courierId);
    },
    /** Control: el repartidor solo ve estos pedidos (o todos con `null`). */
    setScope(ids: string[] | null, courierId = OWN) {
      if (ids === null) scopes.delete(courierId);
      else scopes.set(courierId, new Set(ids));
    },
    reset() {
      rounds.length = 0;
      roundOf.clear();
      profiles.clear();
      scopes.clear();
    },
    rounds,
  };
}
