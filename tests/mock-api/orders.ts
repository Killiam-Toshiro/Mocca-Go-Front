import { randomUUID } from 'node:crypto';
import type { MockMenuItem } from './menu.ts';

/** Zonas y puntos de prueba con la forma de `PublicZoneResponse`. */
export interface MockPoint {
  id: string;
  name: string;
  hint: string | null;
  floors: number | null;
}
export interface MockZone {
  id: string;
  name: string;
  points: MockPoint[];
}

export const POINT_ID = {
  edificioA: '11111111-1111-4111-8111-111111111111',
  plazoleta: '22222222-2222-4222-8222-222222222222',
  biblioteca: '33333333-3333-4333-8333-333333333333',
  cafeteria: '44444444-4444-4444-8444-444444444444',
  canchas: '55555555-5555-4555-8555-555555555555',
} as const;

export function buildZones(): MockZone[] {
  return [
    {
      id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      name: 'Zona 1',
      points: [
        {
          id: POINT_ID.edificioA,
          name: 'Edificio A',
          hint: 'Se entrega en la plazoleta de auditorios',
          floors: 4,
        },
        {
          id: POINT_ID.plazoleta,
          name: 'Plazoleta central',
          hint: null,
          floors: null,
        },
        { id: POINT_ID.biblioteca, name: 'Biblioteca', hint: null, floors: 3 },
      ],
    },
    {
      id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      name: 'Zona 2',
      points: [
        {
          id: POINT_ID.cafeteria,
          name: 'Cafetería',
          hint: 'Junto a la caja',
          floors: null,
        },
        { id: POINT_ID.canchas, name: 'Canchas', hint: null, floors: null },
      ],
    },
  ];
}

export const CARD_APPROVED = '4242424242424242';
export const CARD_REJECTED = '4000000000000002';

export type OrderStatus =
  | 'recibido'
  | 'en_preparacion'
  | 'listo'
  | 'en_camino'
  | 'entregado'
  | 'no_entregado'
  | 'cancelado';

export interface MockOrder {
  id: string;
  number: number;
  status: OrderStatus;
  total: number;
  items: {
    productId: string;
    sku: string;
    name: string;
    category: string;
    quantity: number;
    unitPrice: number;
    lineTotal: number;
    components: {
      productId: string;
      sku: string;
      name: string;
      quantity: number;
    }[];
  }[];
  delivery: {
    pointId: string;
    pointName: string;
    zoneName: string;
    floor: number | null;
    deliveryNote: string | null;
    etaAt: string | null;
    courier: {
      fullName: string;
      phone: string;
      whatsappUrl: string;
    } | null;
  };
  note: string | null;
  payment: {
    method: string;
    last4: string;
    status: 'aprobado' | 'reembolsado';
  };
  customer: { name: string; phone: string };
  cancelReason: string | null;
  failureReason: string | null;
  survey: null;
  events: { status: OrderStatus; at: string }[];
  createdAt: string;
  updatedAt: string;
}

export interface OrderResult {
  status: number;
  body: unknown;
}
const ok = (status: number, body: unknown): OrderResult => ({ status, body });
const err = (status: number, message: string | string[]): OrderResult => ({
  status,
  body: { statusCode: status, message, error: 'Error' },
});

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;
const isNote = (v: unknown): v is string =>
  typeof v === 'string' && v.length >= 1 && v.length <= 200;

/** Almacén de pedidos del mock: reproduce las reglas de `POST /orders` y compañía. */
export function createOrderStore(
  getMenu: () => MockMenuItem[],
  getZones: () => MockZone[],
) {
  const orders: MockOrder[] = [];
  const byKey = new Map<string, string>();
  let next = 1001;

  function create(
    customer: { id: string; name: string; phone: string },
    key: string | undefined,
    body: Record<string, unknown> | null,
  ): OrderResult {
    if (!key || !UUID.test(key))
      return err(400, ['Idempotency-Key debe ser un UUID']);
    const known = byKey.get(`${customer.id}:${key}`);
    const replay = known ? orders.find((o) => o.id === known) : undefined;
    if (replay) return ok(200, replay);

    if (!body) return err(400, ['El cuerpo debe ser un objeto JSON']);
    const problems: string[] = [];
    const { items, pointId, floor, deliveryNote, note, payment } = body;
    if (!Array.isArray(items) || items.length < 1 || items.length > 10)
      problems.push('items debe tener entre 1 y 10 elementos');
    if (typeof pointId !== 'string' || !UUID.test(pointId))
      problems.push('pointId debe ser un UUID');
    if (floor !== undefined && !isInt(floor, 1, 30))
      problems.push('floor debe ser un entero entre 1 y 30');
    if (deliveryNote !== undefined && !isNote(deliveryNote))
      problems.push('deliveryNote debe tener entre 1 y 200 caracteres');
    if (note !== undefined && !isNote(note))
      problems.push('note debe tener entre 1 y 200 caracteres');
    const pay = payment as Record<string, unknown> | undefined;
    if (!pay || pay.method !== 'tarjeta_demo')
      problems.push('payment.method debe ser tarjeta_demo');
    if (
      typeof pay?.cardNumber !== 'string' ||
      !/^[0-9]{16}$/.test(pay.cardNumber)
    )
      problems.push('payment.cardNumber debe tener 16 dígitos');
    const lines: { productId: string; quantity: number }[] = [];
    if (Array.isArray(items)) {
      for (const raw of items as Record<string, unknown>[]) {
        if (typeof raw?.productId !== 'string' || !isInt(raw.quantity, 1, 10)) {
          problems.push('cada item necesita productId y quantity entre 1 y 10');
          break;
        }
        lines.push({
          productId: raw.productId,
          quantity: raw.quantity as number,
        });
      }
    }
    if (problems.length > 0) return err(400, problems);

    const point = getZones()
      .flatMap((z) => z.points.map((p) => ({ zone: z, point: p })))
      .find((x) => x.point.id === pointId);
    if (!point) return err(404, 'Punto de entrega no encontrado');
    if (point.point.floors !== null && floor === undefined)
      return err(400, ['floor es obligatorio en este punto']);
    if (point.point.floors === null && floor !== undefined)
      return err(400, ['Este punto no tiene pisos: no envíes floor']);
    if (point.point.floors !== null && (floor as number) > point.point.floors)
      return err(400, [`floor no puede superar ${point.point.floors}`]);

    const menu = getMenu();
    const built: MockOrder['items'] = [];
    for (const line of lines) {
      const product = menu.find((p) => p.id === line.productId);
      if (!product) return err(404, 'Producto no encontrado');
      if (!product.available) return err(409, `${product.name} está agotado`);
      built.push({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        category: product.category,
        quantity: line.quantity,
        unitPrice: product.price,
        lineTotal: product.price * line.quantity,
        components: product.components.map((c) => ({
          productId: `prod-${c.name.toLowerCase()}`,
          sku: c.name.toUpperCase().slice(0, 8),
          name: c.name,
          quantity: c.quantity,
        })),
      });
    }

    if (pay?.cardNumber === CARD_REJECTED)
      return err(402, 'La tarjeta fue rechazada');

    const now = new Date().toISOString();
    const order: MockOrder = {
      id: randomUUID(),
      number: next++,
      status: 'recibido',
      total: built.reduce((sum, i) => sum + i.lineTotal, 0),
      items: built,
      delivery: {
        pointId: point.point.id,
        pointName: point.point.name,
        zoneName: point.zone.name,
        floor: typeof floor === 'number' ? floor : null,
        deliveryNote: typeof deliveryNote === 'string' ? deliveryNote : null,
        etaAt: null,
        courier: null,
      },
      note: typeof note === 'string' ? note : null,
      payment: {
        method: 'tarjeta_demo',
        last4: String(pay?.cardNumber).slice(-4),
        status: 'aprobado',
      },
      customer: { name: customer.name, phone: customer.phone },
      cancelReason: null,
      failureReason: null,
      survey: null,
      events: [{ status: 'recibido', at: now }],
      createdAt: now,
      updatedAt: now,
    };
    (order as MockOrder & { customerId: string }).customerId = customer.id;
    orders.push(order);
    byKey.set(`${customer.id}:${key}`, order.id);
    return ok(201, order);
  }

  const owned = (customerId: string) =>
    orders.filter(
      (o) =>
        (o as MockOrder & { customerId: string }).customerId === customerId,
    );

  function list(
    customerId: string,
    page: number,
    limit: number,
    status: string | null,
  ): OrderResult {
    const all = owned(customerId)
      .filter((o) => (status ? o.status === status : true))
      .sort((a, b) => b.number - a.number);
    const start = (page - 1) * limit;
    return ok(200, {
      page,
      limit,
      total: all.length,
      totalPages: Math.ceil(all.length / limit),
      data: all.slice(start, start + limit),
    });
  }

  function get(customerId: string, id: string): OrderResult {
    if (!UUID.test(id)) return err(400, ['id debe ser un UUID']);
    const order = owned(customerId).find((o) => o.id === id);
    return order ? ok(200, order) : err(404, 'Pedido no encontrado');
  }

  function setStatus(order: MockOrder, status: OrderStatus): void {
    const at = new Date().toISOString();
    order.status = status;
    order.updatedAt = at;
    order.events.push({ status, at });
    if (status === 'en_camino') {
      order.delivery.courier = {
        fullName: 'Carlos Gómez',
        phone: '+573001234500',
        whatsappUrl: 'https://wa.me/573001234500',
      };
      order.delivery.etaAt = new Date(Date.now() + 15 * 60_000).toISOString();
    } else {
      order.delivery.courier = null;
      order.delivery.etaAt = null;
    }
    if (status === 'no_entregado')
      order.failureReason = 'Nadie recibió el pedido';
  }

  function cancel(customerId: string, id: string): OrderResult {
    if (!UUID.test(id)) return err(400, ['id debe ser un UUID']);
    const order = owned(customerId).find((o) => o.id === id);
    if (!order) return err(404, 'Pedido no encontrado');
    if (order.status !== 'recibido')
      return err(409, 'El pedido ya no se puede cancelar');
    setStatus(order, 'cancelado');
    order.payment.status = 'reembolsado';
    return ok(200, order);
  }

  /** Control para las pruebas: cambia el estado de cualquier pedido. */
  function advance(id: string, status: OrderStatus): OrderResult {
    const order = orders.find((o) => o.id === id);
    if (!order) return err(404, 'Pedido no encontrado');
    setStatus(order, status);
    if (status === 'cancelado') order.payment.status = 'reembolsado';
    return ok(204, undefined);
  }

  function reset(): void {
    orders.length = 0;
    byKey.clear();
    next = 1001;
  }

  return { create, list, get, cancel, advance, reset, orders };
}
