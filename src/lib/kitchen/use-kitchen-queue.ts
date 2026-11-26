'use client';

import { useQuery } from '@tanstack/react-query';
import { isApiError } from '@/lib/api/errors';
import { requestJson } from '@/lib/api/json';
import { useLiveStatus, type LiveStatus } from '@/lib/live/channel';
import type { OrderPage } from '@/lib/orders/types';
import { KITCHEN_PAGE_SIZE, type KitchenStatus } from './board';

export const KITCHEN_POLL_MS = 15_000;

/** Respaldo del canal en vivo: con el canal conectado no hay consulta periódica (D-052). */
export function kitchenRefetchInterval(live: LiveStatus): number | false {
  return live === 'live' ? false : KITCHEN_POLL_MS;
}

/** Una cola de cocina: los pedidos de un estado, el más antiguo primero. */
export function useKitchenQueue(status: KitchenStatus) {
  const live = useLiveStatus();
  return useQuery<OrderPage>({
    queryKey: ['kitchen', status],
    queryFn: () =>
      requestJson<OrderPage>(
        `/api/kitchen/orders?status=${status}&limit=${String(KITCHEN_PAGE_SIZE)}`,
        { method: 'GET', handleUnauthorized: true },
      ),
    refetchInterval: kitchenRefetchInterval(live),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: (count, error) =>
      count < 1 &&
      !(isApiError(error) && error.status >= 400 && error.status < 500),
  });
}

/** Las tres colas del tablero. */
export function useKitchenBoard() {
  return {
    recibido: useKitchenQueue('recibido'),
    en_preparacion: useKitchenQueue('en_preparacion'),
    listo: useKitchenQueue('listo'),
  };
}
