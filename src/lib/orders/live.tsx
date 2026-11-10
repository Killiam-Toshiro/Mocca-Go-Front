'use client';

import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { notifyUnauthorized } from '@/lib/api/browser-client';
import { openSseChannel, type SseState } from '@/lib/sse/client';
import { statusInfo } from './status';

/** `off`: sin canal (sin proveedor, pestaña oculta o fuera de las pantallas del cliente). */
export type LiveStatus = 'off' | SseState;

/** Con la pestaña oculta este tiempo se cierra el canal (el back permite 5 por usuario, D-048). */
export const HIDDEN_CLOSE_MS = 45_000;
export const ORDERS_STREAM_URL = '/api/orders/stream';

const LiveContext = createContext<LiveStatus>('off');

/** Estado del canal en vivo; `off` si no hay proveedor. */
export function useLiveStatus(): LiveStatus {
  return useContext(LiveContext);
}

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

/**
 * Mantiene un único canal SSE por pestaña mientras el cliente ve sus pedidos (D-047, D-048).
 * Cada evento (`ready` u `order`) hace volver a consultar los pedidos: la pantalla nunca se arma
 * con el contenido del evento (D-049). Los cambios de estado se anuncian a lectores de pantalla.
 */
export function OrdersLiveProvider({
  children,
  open = openSseChannel,
}: {
  children: ReactNode;
  /** Para las pruebas. */
  open?: typeof openSseChannel;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<LiveStatus>('off');
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    let channel: { close: () => void } | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    function connect() {
      if (channel) return;
      channel = open({
        url: ORDERS_STREAM_URL,
        onState: setStatus,
        onUnauthorized: notifyUnauthorized,
        onMessage: (message) => {
          if (message.event !== 'ready' && message.event !== 'order') return;
          void queryClient.invalidateQueries({ queryKey: ['orders'] });
          void queryClient.invalidateQueries({ queryKey: ['order'] });
        },
      });
    }

    function disconnect() {
      channel?.close();
      channel = null;
      setStatus('off');
    }

    function onVisibility() {
      clearTimeout(hideTimer);
      if (document.visibilityState === 'hidden') {
        hideTimer = setTimeout(disconnect, HIDDEN_CLOSE_MS);
      } else {
        connect();
      }
    }

    document.addEventListener('visibilitychange', onVisibility);
    if (document.visibilityState !== 'hidden') connect();

    return () => {
      clearTimeout(hideTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      channel?.close();
      channel = null;
    };
  }, [open, queryClient]);

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
    <LiveContext.Provider value={status}>
      {children}
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>
    </LiveContext.Provider>
  );
}
