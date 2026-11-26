'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { requestJson } from '@/lib/api/json';
import { useLiveStatus } from './live';
import { isFinalStatus } from './status';
import type { OrderPage } from './types';
import { ORDER_POLL_MS } from './use-order';

export const ORDERS_PAGE_SIZE = 10;

/** «Mis pedidos»: páginas de 10, más reciente primero; «Ver más» pide la siguiente. */
export function useOrders() {
  const live = useLiveStatus();
  // Respaldo: solo si el canal en vivo cayó o fue rechazado y hay pedidos sin terminar.
  const fallback = live === 'reconnecting' || live === 'stopped';
  return useInfiniteQuery<OrderPage>({
    queryKey: ['orders'],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      requestJson<OrderPage>(
        `/api/orders?page=${String(pageParam)}&limit=${ORDERS_PAGE_SIZE}`,
        { method: 'GET', handleUnauthorized: true },
      ),
    refetchInterval: (query) =>
      fallback &&
      query.state.data?.pages.some((page) =>
        page.data.some((order) => !isFinalStatus(order.status)),
      )
        ? ORDER_POLL_MS
        : false,
    refetchIntervalInBackground: false,
    getNextPageParam: (last) =>
      last.page < last.totalPages ? last.page + 1 : undefined,
  });
}
