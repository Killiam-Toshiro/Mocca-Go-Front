'use client';

import {
  QueryClient,
  QueryClientProvider,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { isApiError } from '@/lib/api/errors';
import { setUnauthorizedHandler } from '@/lib/api/browser-client';
import { buildExpiredUrl, isAuthPagePath } from '@/lib/auth/expire';
import { currentPath, navigate } from '@/lib/browser';

function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Los errores 4xx no mejoran al reintentar.
        retry: (failureCount, error) =>
          failureCount < 2 &&
          !(isApiError(error) && error.status >= 400 && error.status < 500),
      },
    },
  });
}

let ending = false;

/** Qué hacer cuando la sesión terminó: vaciar la caché y pasar por `/api/auth/expired`. */
export function useExpireSession(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    if (ending || isAuthPagePath(window.location.pathname)) return;
    ending = true; // varias peticiones pueden fallar a la vez: se redirige una sola vez
    queryClient.clear();
    navigate(buildExpiredUrl(currentPath()));
  }, [queryClient]);
}

function UnauthorizedBridge() {
  const expire = useExpireSession();
  useEffect(() => {
    setUnauthorizedHandler(expire);
    return () => setUnauthorizedHandler(null);
  }, [expire]);
  return null;
}

/** Para las pruebas: permite volver a disparar el cierre por sesión vencida. */
export function resetExpireGuard(): void {
  ending = false;
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  return (
    <QueryClientProvider client={client}>
      <UnauthorizedBridge />
      {children}
    </QueryClientProvider>
  );
}
