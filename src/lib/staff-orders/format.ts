import { telHref } from '@/lib/dispatch/contact';
import type { Order } from '@/lib/orders/types';

/** «Ana Pérez · +573001112233». */
export function customerLine(order: Pick<Order, 'customer'>): string {
  return `${order.customer.name} · ${order.customer.phone}`;
}

/** «Zona 1 · Edificio A · Piso 2». */
export function deliveryLine(order: Pick<Order, 'delivery'>): string {
  const { zoneName, pointName, floor } = order.delivery;
  return `${zoneName} · ${pointName}${floor !== null ? ` · Piso ${String(floor)}` : ''}`;
}

export { telHref };
