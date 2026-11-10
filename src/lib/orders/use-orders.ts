'use client';

import { useInfiniteQuery } from '@tanstack/react-query';
import { requestJson } from '@/lib/api/json';
import type { OrderPage } from './types';

export const ORDERS_PAGE_SIZE = 10;

/** «Mis pedidos»: páginas de 10, más reciente primero; «Ver más» pide la siguiente. */
export function useOrders() {
  return useInfiniteQuery<OrderPage>({
    queryKey: ['orders'],
    initialPageParam: 1,
    queryFn: ({ pageParam }) =>
      requestJson<OrderPage>(
        `/api/orders?page=${String(pageParam)}&limit=${ORDERS_PAGE_SIZE}`,
        { method: 'GET', handleUnauthorized: true },
      ),
    getNextPageParam: (last) =>
      last.page < last.totalPages ? last.page + 1 : undefined,
  });
}
