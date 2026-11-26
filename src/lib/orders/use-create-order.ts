'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { requestJson } from '@/lib/api/json';
import type { CreateOrderBody } from './body';
import type { Order } from './types';

export interface CreateOrderInput {
  body: CreateOrderBody;
  /** `Idempotency-Key` del intento (D-040). */
  key: string;
}

/**
 * `POST /orders`. Sin reintentos automáticos (un reintento es decisión del cliente, con la
 * misma clave) y `gcTime: 0`: el cuerpo, que lleva la tarjeta, no se conserva en la caché (D-038).
 */
export function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation<Order, Error, CreateOrderInput>({
    gcTime: 0,
    retry: false,
    mutationFn: ({ body, key }) =>
      requestJson<Order>('/api/orders', {
        method: 'POST',
        body,
        headers: { 'idempotency-key': key },
        handleUnauthorized: true,
      }),
    onSuccess: (order) => {
      queryClient.setQueryData(['order', order.id], order);
      void queryClient.invalidateQueries({ queryKey: ['orders'] });
    },
  });
}
