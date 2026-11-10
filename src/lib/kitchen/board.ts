import type { Order, OrderPage } from '@/lib/orders/types';

export type KitchenStatus = 'recibido' | 'en_preparacion' | 'listo';

export const KITCHEN_STATUSES: readonly KitchenStatus[] = [
  'recibido',
  'en_preparacion',
  'listo',
];

export const COLUMN_TITLE: Record<KitchenStatus, string> = {
  recibido: 'Por preparar',
  en_preparacion: 'En preparación',
  listo: 'Listos',
};

/** Pedidos que se piden por cola (el máximo que admite el back). */
export const KITCHEN_PAGE_SIZE = 100;
/** «Listos» muestra solo los más antiguos hasta que se pide ver todos (D-056). */
export const READY_VISIBLE = 10;
/** Minutos de espera desde los que se marca «espera larga» (D-062). */
export const LONG_WAIT_MINUTES: Record<KitchenStatus, number> = {
  recibido: 5,
  en_preparacion: 15,
  listo: 10,
};
/** Cada cuánto se refresca el «hace X min». */
export const CLOCK_MS = 30_000;

export function isKitchenStatus(status: string): status is KitchenStatus {
  return (KITCHEN_STATUSES as readonly string[]).includes(status);
}

/** Desde cuándo está el pedido en su estado actual (último evento de ese estado). */
export function sinceFor(order: Order): string {
  for (let i = order.events.length - 1; i >= 0; i--) {
    const event = order.events[i];
    if (event && event.status === order.status) return event.at;
  }
  return order.createdAt;
}

/** Minutos completos transcurridos desde `since` hasta `now` (milisegundos). */
export function waitMinutes(since: string, now: number): number {
  const start = Date.parse(since);
  if (Number.isNaN(start)) return 0;
  return Math.max(0, Math.floor((now - start) / 60_000));
}

/** «8 min», «1 h», «1 h 15 min». */
export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${String(minutes)} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0
    ? `${String(hours)} h`
    : `${String(hours)} h ${String(rest)} min`;
}

export function waitLabel(minutes: number): string {
  return minutes < 1 ? 'hace un momento' : `hace ${durationLabel(minutes)}`;
}

export function isLongWait(status: KitchenStatus, minutes: number): boolean {
  return minutes >= LONG_WAIT_MINUTES[status];
}

/** Los más antiguos de «Listos», o todos si se pidió ver el resto. */
export function visibleReady<T>(orders: readonly T[], expanded: boolean): T[] {
  return expanded ? [...orders] : orders.slice(0, READY_VISIBLE);
}

/** Quita un pedido de una cola en caché (y descuenta del total). */
export function removeOrder(
  page: OrderPage | undefined,
  id: string,
): OrderPage | undefined {
  if (!page || !page.data.some((o) => o.id === id)) return page;
  return {
    ...page,
    total: Math.max(0, page.total - 1),
    data: page.data.filter((o) => o.id !== id),
  };
}

/** Agrega (o reemplaza) un pedido en una cola en caché, manteniendo el más antiguo primero. */
export function insertOrder(
  page: OrderPage | undefined,
  order: Order,
): OrderPage | undefined {
  if (!page) return page;
  const exists = page.data.some((o) => o.id === order.id);
  const data = [...page.data.filter((o) => o.id !== order.id), order].sort(
    (a, b) => a.number - b.number,
  );
  return { ...page, total: exists ? page.total : page.total + 1, data };
}

/** `tel:` solo si el teléfono tiene la forma esperada; si no, se muestra como texto. */
export function telHref(phone: string): string | null {
  if (!/^\+?[0-9 ()-]{7,20}$/.test(phone)) return null;
  const digits = phone.replace(/[^0-9]/g, '');
  return digits.length >= 7
    ? `tel:${phone.startsWith('+') ? '+' : ''}${digits}`
    : null;
}
