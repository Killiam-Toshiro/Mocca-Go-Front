'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { requestJson } from '@/lib/api/json';
import type { Order, OrderPage } from '@/lib/orders/types';
import { insertOrder, removeOrder, type KitchenStatus } from './board';

export type KitchenAction = 'start' | 'ready';

const MOVE: Record<KitchenAction, { from: KitchenStatus; to: KitchenStatus }> =
  {
    start: { from: 'recibido', to: 'en_preparacion' },
    ready: { from: 'en_preparacion', to: 'listo' },
  };

/**
 * `POST /kitchen/orders/:id/start|ready`. Al terminar mueve el pedido de cola con la respuesta del
 * back (la tarjeta cambia de columna al instante) y vuelve a consultar para que el back confirme.
 */
export function useKitchenAction(
  action: KitchenAction,
  /** Se llama con el pedido ya movido (aunque la tarjeta ya no exista). */
  onDone?: (order: Order) => void,
  /** Se llama con el error (p. ej. 409) aunque la tarjeta ya no exista. */
  onFail?: (error: unknown) => void,
) {
  const queryClient = useQueryClient();
  const { from, to } = MOVE[action];
  return useMutation<Order, Error, string>({
    retry: false,
    mutationFn: (id) =>
      requestJson<Order>(
        `/api/kitchen/orders/${encodeURIComponent(id)}/${action}`,
        { method: 'POST', handleUnauthorized: true },
      ),
    onSuccess: (order) => {
      queryClient.setQueryData<OrderPage>(['kitchen', from], (page) =>
        removeOrder(page, order.id),
      );
      queryClient.setQueryData<OrderPage>(['kitchen', to], (page) =>
        insertOrder(page, order),
      );
      void queryClient.invalidateQueries({ queryKey: ['kitchen'] });
      onDone?.(order);
    },
    onError: (error) => {
      // 409/404: el estado cambió; se trae la cola real.
      void queryClient.invalidateQueries({ queryKey: ['kitchen'] });
      onFail?.(error);
    },
  });
}
