import type { components } from '@/lib/api/schema';

export type OrderStatus = components['schemas']['OrderResponse']['status'];

export type StatusTone = 'info' | 'progress' | 'success' | 'danger';
export type StatusIcon =
  | 'recibido'
  | 'preparacion'
  | 'listo'
  | 'camino'
  | 'entregado'
  | 'no-entregado'
  | 'cancelado';

interface StatusInfo {
  label: string;
  tone: StatusTone;
  icon: StatusIcon;
  final: boolean;
}

/** Etiqueta, tono e ícono de cada estado: nunca solo color (D-046). */
export const ORDER_STATUS: Record<OrderStatus, StatusInfo> = {
  recibido: { label: 'Recibido', tone: 'info', icon: 'recibido', final: false },
  en_preparacion: {
    label: 'En preparación',
    tone: 'progress',
    icon: 'preparacion',
    final: false,
  },
  listo: { label: 'Listo', tone: 'progress', icon: 'listo', final: false },
  en_camino: {
    label: 'En camino',
    tone: 'progress',
    icon: 'camino',
    final: false,
  },
  entregado: {
    label: 'Entregado',
    tone: 'success',
    icon: 'entregado',
    final: true,
  },
  no_entregado: {
    label: 'No entregado',
    tone: 'danger',
    icon: 'no-entregado',
    final: true,
  },
  cancelado: {
    label: 'Cancelado',
    tone: 'danger',
    icon: 'cancelado',
    final: true,
  },
};

export function statusInfo(status: string): StatusInfo {
  return (
    ORDER_STATUS[status as OrderStatus] ?? {
      label: status,
      tone: 'info',
      icon: 'recibido',
      final: false,
    }
  );
}

export function isFinalStatus(status: string): boolean {
  return statusInfo(status).final;
}

/** Orden natural del flujo (para la línea de tiempo). */
export const FLOW: readonly OrderStatus[] = [
  'recibido',
  'en_preparacion',
  'listo',
  'en_camino',
  'entregado',
];
