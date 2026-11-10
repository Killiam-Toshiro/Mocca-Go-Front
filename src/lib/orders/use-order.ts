'use client';

import { useQuery } from '@tanstack/react-query';
import { isApiError } from '@/lib/api/errors';
import { requestJson } from '@/lib/api/json';
import { isFinalStatus } from './status';
import type { Order } from './types';

export const ORDER_POLL_MS = 15_000;

/** Cada 15 s mientras el pedido no termine; nunca en un estado final (D-043). */
export function orderRefetchInterval(order: Order | undefined): number | false {
  return order && !isFinalStatus(order.status) ? ORDER_POLL_MS : false;
}

/** Un pedido propio. 404 si no existe o es de otro cliente. */
export function useOrder(id: string) {
  return useQuery<Order>({
    queryKey: ['order', id],
    queryFn: () =>
      requestJson<Order>(`/api/orders/${encodeURIComponent(id)}`, {
        method: 'GET',
        handleUnauthorized: true,
      }),
    refetchInterval: (query) => orderRefetchInterval(query.state.data),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: (count, error) =>
      count < 1 &&
      !(isApiError(error) && error.status >= 400 && error.status < 500),
  });
}
