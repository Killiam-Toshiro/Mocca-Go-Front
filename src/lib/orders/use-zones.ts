'use client';

import { useQuery } from '@tanstack/react-query';
import { requestJson } from '@/lib/api/json';
import type { components } from '@/lib/api/schema';
import type { Zone } from './types';

export const ZONES_STALE_MS = 60_000;

/** Zonas y puntos de entrega activos (`GET /delivery-zones`, pública). */
export function useZones() {
  return useQuery<Zone[]>({
    queryKey: ['zones'],
    queryFn: async () => {
      const body = await requestJson<
        components['schemas']['PublicZonesResponse']
      >('/api/delivery-zones', { method: 'GET' });
      return body.data;
    },
    staleTime: ZONES_STALE_MS,
  });
}
