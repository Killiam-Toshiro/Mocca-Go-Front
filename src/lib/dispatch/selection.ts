import type { Queue } from './types';

/** Topes del back; aquí solo son comodidad, el back los impone. */
export const MAX_ROUND_ORDERS = 5;
export const MAX_ACTIVE_ROUNDS = 2;

export interface Pick {
  id: string;
  number: number;
}

/** Pedidos elegidos para una ronda propia: todos de una misma zona. */
export interface Selection {
  zoneId: string | null;
  picks: Pick[];
}

export const NO_SELECTION: Selection = { zoneId: null, picks: [] };

export type Blocked = null | 'other-zone' | 'full';

export const BLOCKED_TEXT: Record<Exclude<Blocked, null>, string> = {
  'other-zone': 'Una ronda es de una sola zona',
  full: `Máximo ${String(MAX_ROUND_ORDERS)} pedidos por ronda`,
};

export const isPicked = (selection: Selection, id: string): boolean =>
  selection.picks.some((p) => p.id === id);

/** Por qué no se puede elegir ese pedido (null = se puede; quitar siempre se puede). */
export function blockedReason(
  selection: Selection,
  zoneId: string,
  orderId: string,
): Blocked {
  if (isPicked(selection, orderId)) return null;
  if (selection.zoneId !== null && selection.zoneId !== zoneId)
    return 'other-zone';
  if (selection.picks.length >= MAX_ROUND_ORDERS) return 'full';
  return null;
}

/** Marca o desmarca un pedido; si la elección queda vacía, la zona se libera. */
export function toggle(
  selection: Selection,
  zoneId: string,
  pick: Pick,
): Selection {
  if (isPicked(selection, pick.id)) {
    const picks = selection.picks.filter((p) => p.id !== pick.id);
    return picks.length === 0
      ? NO_SELECTION
      : { zoneId: selection.zoneId, picks };
  }
  if (blockedReason(selection, zoneId, pick.id) !== null) return selection;
  return { zoneId, picks: [...selection.picks, pick] };
}

/**
 * Quita de la elección los pedidos que ya no están `listo` en la cola (otro repartidor los
 * tomó, se cancelaron…). Devuelve la elección depurada y los quitados.
 */
export function prune(
  selection: Selection,
  queue: Queue | undefined,
): { selection: Selection; removed: Pick[] } {
  if (!queue || selection.picks.length === 0) return { selection, removed: [] };
  const live = new Set<string>();
  for (const zone of queue.zones)
    for (const order of zone.orders) live.add(order.id);
  const kept = selection.picks.filter((p) => live.has(p.id));
  if (kept.length === selection.picks.length) return { selection, removed: [] };
  return {
    selection:
      kept.length === 0
        ? NO_SELECTION
        : { zoneId: selection.zoneId, picks: kept },
    removed: selection.picks.filter((p) => !live.has(p.id)),
  };
}
