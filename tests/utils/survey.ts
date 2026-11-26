import { vi } from 'vitest';
import type { Order } from '@/lib/orders/types';
import { jsonResponse } from './render';

/** Pedido del back con todos sus campos; por defecto entregado y sin encuesta. */
export function surveyOrder(over: Partial<Order> = {}): Order {
  return {
    id: 'o1',
    number: 1001,
    status: 'entregado',
    total: 9000,
    items: [
      {
        productId: 'a',
        sku: 'A',
        name: 'Capuchino',
        category: 'cafe',
        quantity: 2,
        unitPrice: 4500,
        lineTotal: 9000,
        components: [],
      },
    ],
    delivery: {
      pointId: 'p',
      pointName: 'Edificio A',
      zoneName: 'Zona 1',
      floor: 2,
      deliveryNote: null,
      etaAt: null,
      courier: null,
    },
    note: null,
    payment: { method: 'tarjeta_demo', last4: '4242', status: 'aprobado' },
    customer: { name: 'Ana', phone: '+573001234567' },
    cancelReason: null,
    failureReason: null,
    survey: null,
    events: [{ status: 'entregado', at: '2026-11-11T17:31:00Z' }],
    createdAt: '2026-11-11T17:00:00Z',
    updatedAt: '2026-11-11T17:31:00Z',
    ...over,
  } as Order;
}

export type SurveyBehavior =
  | 'ok'
  /** Otra pestaña ya la guardó: 409 «ya tiene una respuesta». */
  | 'already'
  /** Se guarda pero la respuesta se pierde (corte de red). */
  | 'network-saved'
  /** No se guarda y la respuesta se pierde. */
  | 'network'
  | { status: number; message: string };

/** `fetch` del back para la encuesta: `GET /api/orders/:id` y `POST /api/orders/:id/survey`. */
export function fakeSurveyBack(
  initial: Order,
  behavior: SurveyBehavior = 'ok',
) {
  const state = { order: initial, behavior };
  const calls: { method: string; url: string; body: unknown }[] = [];
  const save = (body: { rating: number; comment?: string }) => {
    state.order = {
      ...state.order,
      survey: {
        rating: body.rating,
        comment: body.comment ?? null,
        createdAt: '2026-11-11T18:00:00Z',
      },
    };
    return state.order.survey!;
  };
  const stub = vi.fn((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    if (method === 'GET') return Promise.resolve(jsonResponse(state.order));
    const b = state.behavior;
    if (b === 'network') return Promise.reject(new TypeError('red caída'));
    if (b === 'network-saved') {
      save(body);
      return Promise.reject(new TypeError('red caída'));
    }
    if (b === 'already') {
      save({ rating: 5 });
      return Promise.resolve(
        jsonResponse(
          {
            statusCode: 409,
            message: 'Este pedido ya tiene una respuesta de la encuesta.',
          },
          409,
        ),
      );
    }
    if (typeof b === 'object')
      return Promise.resolve(
        jsonResponse({ statusCode: b.status, message: b.message }, b.status),
      );
    const survey = save(body);
    return Promise.resolve(
      jsonResponse({ orderId: state.order.id, ...survey }, 201),
    );
  });
  vi.stubGlobal('fetch', stub);
  return {
    calls,
    state,
    posts: () => calls.filter((c) => c.method === 'POST'),
  };
}
