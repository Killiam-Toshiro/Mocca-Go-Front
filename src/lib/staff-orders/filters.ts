import type { OrderStatus } from '@/lib/orders/status';

export type StatusFilter = 'todos' | OrderStatus;

export const STATUS_FILTERS: readonly { value: StatusFilter; label: string }[] =
  [
    { value: 'todos', label: 'Todos los estados' },
    { value: 'recibido', label: 'Recibido' },
    { value: 'en_preparacion', label: 'En preparación' },
    { value: 'listo', label: 'Listo' },
    { value: 'en_camino', label: 'En camino' },
    { value: 'entregado', label: 'Entregado' },
    { value: 'no_entregado', label: 'No entregado' },
    { value: 'cancelado', label: 'Cancelado' },
  ];

/** Solo se puede cancelar un pedido que aún no salió de cocina (D-121). */
export function canCancel(status: string): boolean {
  return status === 'recibido' || status === 'en_preparacion';
}
