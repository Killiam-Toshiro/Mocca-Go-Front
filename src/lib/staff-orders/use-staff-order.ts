'use client';

import { useQuery } from '@tanstack/react-query';
import { isApiError } from '@/lib/api/errors';
import { requestJson } from '@/lib/api/json';
import type { Order } from '@/lib/orders/types';

export const STAFF_ORDER_KEY = ['staff-order'] as const;

export function useStaffOrder(id: string) {
  return useQuery<Order>({
    queryKey: [...STAFF_ORDER_KEY, id],
    queryFn: () =>
      requestJson<Order>(`/api/orders/${encodeURIComponent(id)}`, {
        method: 'GET',
        handleUnauthorized: true,
      }),
    refetchOnWindowFocus: true,
    retry: (count, error) =>
      count < 1 &&
      !(isApiError(error) && error.status >= 400 && error.status < 500),
  });
}
