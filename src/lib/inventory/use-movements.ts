'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { isApiError } from '@/lib/api/errors';
import { requestJson } from '@/lib/api/json';
import type { MovementPage, MovementType } from './types';

export const MOVEMENTS_PAGE_SIZE = 20;
export const MOVEMENTS_POLL_MS = 30_000;

export interface MovementFilter {
  page: number;
  productId: string | null;
  type: MovementType | null;
}

export function movementsUrl(filter: MovementFilter): string {
  const params = new URLSearchParams({
    page: String(filter.page),
    limit: String(MOVEMENTS_PAGE_SIZE),
  });
  if (filter.productId) params.set('productId', filter.productId);
  if (filter.type) params.set('type', filter.type);
  return `/api/movements?${params.toString()}`;
}

/** Historial de movimientos, el más reciente primero, con filtros y paginación. */
export function useMovements(filter: MovementFilter) {
  return useQuery<MovementPage>({
    queryKey: ['movements', filter.page, filter.productId, filter.type],
    queryFn: () =>
      requestJson<MovementPage>(movementsUrl(filter), {
        method: 'GET',
        handleUnauthorized: true,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: MOVEMENTS_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: (count, error) =>
      count < 1 &&
      !(isApiError(error) && error.status >= 400 && error.status < 500),
  });
}
