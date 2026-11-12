'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { requestJson } from '@/lib/api/json';
import type { Order, OrderPage } from '@/lib/orders/types';
import { removeOrder } from './board';

/** `POST /orders/:id/cancel` con motivo (admin y operador, en recibido o en preparación). */
export function useKitchenCancel(
  onDone?: (order: Order) => void,
  onFail?: (error: unknown) => void,
) {
  const queryClient = useQueryClient();
  return useMutation<Order, Error, { id: string; reason: string }>({
    retry: false,
    mutationFn: ({ id, reason }) =>
      requestJson<Order>(`/api/orders/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
        body: { reason },
        handleUnauthorized: true,
      }),
    onSuccess: (order) => {
      for (const status of ['recibido', 'en_preparacion'] as const) {
        queryClient.setQueryData<OrderPage>(['kitchen', status], (page) =>
          removeOrder(page, order.id),
        );
      }
      void queryClient.invalidateQueries({ queryKey: ['kitchen'] });
      void queryClient.invalidateQueries({ queryKey: ['staff-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['staff-order'] });
      onDone?.(order);
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: ['kitchen'] });
      void queryClient.invalidateQueries({ queryKey: ['staff-orders'] });
      void queryClient.invalidateQueries({ queryKey: ['staff-order'] });
      onFail?.(error);
    },
  });
}
