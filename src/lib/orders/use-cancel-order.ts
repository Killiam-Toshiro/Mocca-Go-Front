'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { requestJson } from '@/lib/api/json';
import type { Order } from './types';

/** `POST /orders/:id/cancel` (sin cuerpo para el cliente). Actualiza el detalle con la respuesta. */
export function useCancelOrder(id: string) {
  const queryClient = useQueryClient();
  return useMutation<Order, Error, void>({
    retry: false,
    mutationFn: () =>
      requestJson<Order>(`/api/orders/${encodeURIComponent(id)}/cancel`, {
        method: 'POST',
        handleUnauthorized: true,
      }),
    onSuccess: (order) => {
      queryClient.setQueryData(['order', id], order);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
    onError: () => {
      // 409: el estado cambió; se trae el pedido real.
      void queryClient.invalidateQueries({ queryKey: ['order', id] });
    },
  });
}
