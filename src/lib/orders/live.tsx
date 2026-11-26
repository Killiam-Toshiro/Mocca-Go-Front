'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';
import {
  HIDDEN_CLOSE_MS,
  LiveChannelProvider,
  useLiveStatus,
  type LiveStatus,
} from '@/lib/live/channel';
import type { openSseChannel } from '@/lib/sse/client';
import { statusInfo } from './status';

export { HIDDEN_CLOSE_MS, useLiveStatus };
export type { LiveStatus };

export const ORDERS_STREAM_URL = '/api/orders/stream';
const ORDER_KEYS = [['orders'], ['order']] as const;

interface Seen {
  id: string;
  number: number;
  status: string;
}

/** Saca de lo que hay en la caché los pedidos con la forma esperada (ignora lo demás). */
function ordersIn(key: readonly unknown[], data: unknown): Seen[] {
  const candidates: unknown[] = [];
  if (key[0] === 'order') candidates.push(data);
  else if (key[0] === 'orders') {
    const pages = (data as { pages?: unknown } | undefined)?.pages;
    if (Array.isArray(pages)) {
      for (const page of pages) {
        const list = (page as { data?: unknown } | undefined)?.data;
        if (Array.isArray(list)) candidates.push(...(list as unknown[]));
      }
    }
  }
  return candidates.filter(
    (o): o is Seen =>
      typeof o === 'object' &&
      o !== null &&
      typeof (o as Seen).id === 'string' &&
      typeof (o as Seen).number === 'number' &&
      typeof (o as Seen).status === 'string',
  );
}

/** Anuncia a lectores de pantalla los cambios de estado de los pedidos que ya conocía. */
function OrderAnnouncer() {
  const queryClient = useQueryClient();
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    const known = new Map<string, string>();
    return queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success') return;
      for (const order of ordersIn(
        event.query.queryKey,
        event.query.state.data,
      )) {
        const before = known.get(order.id);
        known.set(order.id, order.status);
        if (before !== undefined && before !== order.status) {
          setAnnouncement(
            `Pedido #${String(order.number)}: ${statusInfo(order.status).label}`,
          );
        }
      }
    });
  }, [queryClient]);

  return (
    <p aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </p>
  );
}

/**
 * Canal en vivo del cliente mientras ve sus pedidos (D-047 a D-054): cada evento vuelve a
 * consultar los pedidos y los cambios de estado se anuncian a lectores de pantalla.
 */
export function OrdersLiveProvider({
  children,
  open,
}: {
  children: ReactNode;
  /** Para las pruebas. */
  open?: typeof openSseChannel;
}) {
  return (
    <LiveChannelProvider
      url={ORDERS_STREAM_URL}
      invalidate={ORDER_KEYS}
      open={open}
    >
      {children}
      <OrderAnnouncer />
    </LiveChannelProvider>
  );
}
