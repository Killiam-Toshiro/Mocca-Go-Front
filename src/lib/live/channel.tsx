'use client';

import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import { notifyUnauthorized } from '@/lib/api/browser-client';
import { openSseChannel, type SseState } from '@/lib/sse/client';

/** `off`: sin canal (sin proveedor, pestaña oculta o fuera de las pantallas que lo usan). */
export type LiveStatus = 'off' | SseState;

/** Con la pestaña oculta este tiempo se cierra el canal (el back permite 5 por usuario, D-048). */
export const HIDDEN_CLOSE_MS = 45_000;

const LiveContext = createContext<LiveStatus>('off');

/** Estado del canal en vivo; `off` si no hay proveedor. */
export function useLiveStatus(): LiveStatus {
  return useContext(LiveContext);
}

/**
 * Mantiene un único canal SSE por pestaña (D-047, D-048). Cada evento (`ready` u `order`) hace
 * volver a consultar las claves indicadas: la pantalla nunca se arma con el contenido del
 * evento (D-049). `invalidate` debe ser una constante (no se crea en cada render).
 */
export function LiveChannelProvider({
  url,
  invalidate,
  children,
  open = openSseChannel,
}: {
  url: string;
  invalidate: readonly QueryKey[];
  children: ReactNode;
  /** Para las pruebas. */
  open?: typeof openSseChannel;
}) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<LiveStatus>('off');

  useEffect(() => {
    let channel: { close: () => void } | null = null;
    let hideTimer: ReturnType<typeof setTimeout> | undefined;

    function connect() {
      if (channel) return;
      channel = open({
        url,
        onState: setStatus,
        onUnauthorized: notifyUnauthorized,
        onMessage: (message) => {
          if (message.event !== 'ready' && message.event !== 'order') return;
          for (const queryKey of invalidate) {
            void queryClient.invalidateQueries({ queryKey });
          }
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
  }, [open, queryClient, url, invalidate]);

  return <LiveContext.Provider value={status}>{children}</LiveContext.Provider>;
}
