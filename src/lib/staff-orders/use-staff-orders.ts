'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { isApiError } from '@/lib/api/errors';
import { requestJson } from '@/lib/api/json';
import type { OrderPage } from '@/lib/orders/types';
import type { StatusFilter } from './filters';

export const STAFF_ORDERS_PAGE_SIZE = 20;
export const STAFF_ORDERS_KEY = ['staff-orders'] as const;

export function staffOrdersUrl(page: number, status: StatusFilter): string {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(STAFF_ORDERS_PAGE_SIZE),
  });
  if (status !== 'todos') params.set('status', status);
  return `/api/orders?${params.toString()}`;
}

/** Todos los pedidos (admin y operador), el más reciente primero; el canal en vivo los refresca (D-122). */
export function useStaffOrders(page: number, status: StatusFilter) {
  return useQuery<OrderPage>({
    queryKey: [...STAFF_ORDERS_KEY, page, status],
    queryFn: () =>
      requestJson<OrderPage>(staffOrdersUrl(page, status), {
        method: 'GET',
        handleUnauthorized: true,
      }),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    retry: (count, error) =>
      count < 1 &&
      !(isApiError(error) && error.status >= 400 && error.status < 500),
  });
}
