import { durationLabel } from '@/lib/kitchen/board';
import type { Order } from '@/lib/orders/types';
import type { Round } from './types';

export interface Progress {
  total: number;
  delivered: number;
  failed: number;
  pending: number;
  /** Cerrados: entregados + no entregados. */
  closed: number;
}

export function roundProgress(round: Pick<Round, 'orders'>): Progress {
  const total = round.orders.length;
  const delivered = round.orders.filter((o) => o.status === 'entregado').length;
  const failed = round.orders.filter((o) => o.status === 'no_entregado').length;
  const pending = round.orders.filter((o) => o.status === 'en_camino').length;
  return { total, delivered, failed, pending, closed: delivered + failed };
}

/** «2 de 4 entregados» (los no entregados cuentan como cerrados, no como entregados). */
export function progressLabel(p: Progress): string {
  return `${String(p.delivered)} de ${String(p.total)} entregados`;
}

/** Minutos que lleva vencida la hora estimada (0 si aún no vence). */
export function overdueMinutes(etaAt: string, now: number): number {
  const eta = Date.parse(etaAt);
  if (Number.isNaN(eta) || now <= eta) return 0;
  return Math.max(1, Math.floor((now - eta) / 60_000));
}

/** Solo se marca vencida una ronda con pedidos pendientes. */
export function isOverdue(
  round: Pick<Round, 'etaAt' | 'orders'>,
  now: number,
): boolean {
  return (
    roundProgress(round).pending > 0 && overdueMinutes(round.etaAt, now) > 0
  );
}

export const overdueLabel = (minutes: number): string =>
  `Vencida hace ${durationLabel(minutes)}`;

/** «Ronda terminada: 3 entregados, 1 no entregado». */
export function finishedText(p: Progress): string {
  const delivered = `${String(p.delivered)} ${p.delivered === 1 ? 'entregado' : 'entregados'}`;
  const failed = `${String(p.failed)} no ${p.failed === 1 ? 'entregado' : 'entregados'}`;
  return `Ronda terminada: ${delivered}, ${failed}`;
}

/** Productos del pedido en una línea: «2 × Capuchino, 1 × Mocca». */
export function itemsSummary(order: Pick<Order, 'items'>): string {
  return order.items.map((i) => `${String(i.quantity)} × ${i.name}`).join(', ');
}

/** Hora de Bogotá, «3:45 p. m.». */
export function clock(iso: string): string {
  return new Intl.DateTimeFormat('es-CO', {
    timeZone: 'America/Bogota',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

/** Reemplaza un pedido dentro de las rondas (con la respuesta del back); quita la ronda si terminó. */
export function replaceOrder(rounds: Round[], order: Order): Round[] {
  return rounds.map((round) =>
    round.orders.some((o) => o.id === order.id)
      ? {
          ...round,
          orders: round.orders.map((o) => (o.id === order.id ? order : o)),
        }
      : round,
  );
}
