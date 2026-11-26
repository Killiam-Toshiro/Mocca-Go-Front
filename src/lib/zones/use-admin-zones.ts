'use client';

import { useQuery, type QueryClient } from '@tanstack/react-query';
import { isApiError } from '@/lib/api/errors';
import { requestJson } from '@/lib/api/json';
import type { AdminZone, AdminZones } from './types';

export const ADMIN_ZONES_KEY = ['admin-zones'] as const;

export async function fetchAdminZones(): Promise<AdminZone[]> {
  const body = await requestJson<AdminZones>('/api/delivery-zones/all', {
    method: 'GET',
    handleUnauthorized: true,
  });
  return body.data;
}

/** Tras cualquier cambio: la lista del admin y la lista pública que usa el pago del cliente. */
export function invalidateZones(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ADMIN_ZONES_KEY });
  void queryClient.invalidateQueries({ queryKey: ['zones'] });
}

/** Todas las zonas con todos sus puntos, activos e inactivos (el back las ordena por nombre). */
export function useAdminZones() {
  return useQuery<AdminZone[]>({
    queryKey: ADMIN_ZONES_KEY,
    queryFn: fetchAdminZones,
    refetchOnWindowFocus: true,
    retry: (count, error) =>
      count < 1 &&
      !(isApiError(error) && error.status >= 400 && error.status < 500),
  });
}
