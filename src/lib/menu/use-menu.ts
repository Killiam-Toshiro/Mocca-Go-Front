'use client';

import { useQuery } from '@tanstack/react-query';
import { isApiError } from '@/lib/api/errors';
import { requestJson } from '@/lib/api/json';
import type { components } from '@/lib/api/schema';
import type { MenuItem } from './categories';

export const MENU_STALE_MS = 30_000;

/**
 * Menú vigente (público). Se refresca al volver a la pestaña para que «Agotado» se
 * actualice sin recargar (D-032). `GET /menu` no necesita sesión.
 */
export function useMenu() {
  return useQuery<MenuItem[]>({
    queryKey: ['menu'],
    queryFn: async () => {
      const body = await requestJson<components['schemas']['MenuResponse']>(
        '/api/menu',
        { method: 'GET' },
      );
      return body.data;
    },
    staleTime: MENU_STALE_MS,
    refetchOnWindowFocus: true,
    // Un 429 no se reintenta solo (empeoraría); un fallo de red, una vez.
    retry: (count, error) =>
      count < 1 && !(isApiError(error) && error.status === 429),
  });
}
