import type { Order, OrderPage } from '@/lib/orders/types';

/** Pedido mínimo con la forma de `OrderResponse` para las pruebas de cocina. */
export function kitchenOrder(
  over: Partial<Order> & { number?: number } = {},
): Order {
  const number = over.number ?? 1001;
  return {
    id: `00000000-0000-4000-8000-${String(number).padStart(12, '0')}`,
    number,
    status: 'recibido',
    total: 9000,
    items: [
      {
        productId: 'p1',
        sku: 'CAF-CAPU',
        name: 'Capuchino (caliente)',
        category: 'cafe',
        quantity: 2,
        unitPrice: 4500,
        lineTotal: 9000,
        components: [],
      },
    ],
    delivery: {
      pointId: 'pt1',
      pointName: 'Edificio A',
      zoneName: 'Zona 1',
      floor: 2,
      deliveryNote: null,
      etaAt: null,
      courier: null,
    },
    note: null,
    payment: { method: 'tarjeta_demo', last4: '4242', status: 'aprobado' },
    customer: { name: 'Carlos Sarmiento', phone: '+573005874455' },
    cancelReason: null,
    failureReason: null,
    survey: null,
    events: [{ status: 'recibido', at: '2026-11-10T18:00:00.000Z' }],
    createdAt: '2026-11-10T18:00:00.000Z',
    updatedAt: '2026-11-10T18:00:00.000Z',
    ...over,
  } as Order;
}

export function kitchenPage(orders: Order[]): OrderPage {
  return {
    page: 1,
    limit: 100,
    total: orders.length,
    totalPages: 1,
    data: orders,
  } as OrderPage;
}
