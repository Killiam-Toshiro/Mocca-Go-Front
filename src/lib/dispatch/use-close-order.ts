'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { requestJson } from '@/lib/api/json';
import type { Order } from '@/lib/orders/types';
import { describeCloseError, type DispatchError } from './errors';
import { replaceOrder, roundProgress, type Progress } from './rounds';
import type { Round, RoundPage } from './types';
import { fetchRounds, ROUNDS_KEY } from './use-dispatch-queue';

export type CloseKind = 'deliver' | 'fail';

export interface CloseHandlers {
  /** `finished`: este era el último pedido pendiente y la ronda terminó. */
  onDone?: (order: Order, finished: Progress | null) => void;
  /** `retryable`: el cambio no quedó registrado y se puede volver a intentar. */
  onFail?: (error: DispatchError, retryable: boolean) => void;
}

/**
 * `POST /dispatch/orders/:id/deliver|fail`. Una sola petición por vez (marca síncrona), sin
 * reintento automático: tras un corte de red se consulta la ronda y se decide con lo que hay.
 */
export function useCloseOrder(handlers: CloseHandlers = {}) {
  const queryClient = useQueryClient();
  const busy = useRef(false);
  const latest = useRef(handlers);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    latest.current = handlers;
  });

  async function run(
    kind: CloseKind,
    id: string,
    reason?: string,
  ): Promise<void> {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      const order = await requestJson<Order>(
        `/api/dispatch/orders/${encodeURIComponent(id)}/${kind}`,
        {
          method: 'POST',
          body: kind === 'fail' ? { reason: reason?.trim() ?? '' } : undefined,
          handleUnauthorized: true,
        },
      );
      const page = queryClient.getQueryData<RoundPage>(ROUNDS_KEY);
      const owner = page?.data.find((r) => r.orders.some((o) => o.id === id));
      const updated: Round | undefined = owner
        ? replaceOrder([owner], order)[0]
        : undefined;
      const progress = updated ? roundProgress(updated) : null;
      const finished = progress && progress.pending === 0 ? progress : null;
      queryClient.setQueryData<RoundPage>(ROUNDS_KEY, (current) => {
        if (!current) return current;
        const data = replaceOrder(current.data, order);
        return finished
          ? {
              ...current,
              total: Math.max(0, current.total - 1),
              data: data.filter((r) => r.id !== owner?.id),
            }
          : { ...current, data };
      });
      void queryClient.invalidateQueries({ queryKey: ['dispatch'] });
      latest.current.onDone?.(order, finished);
    } catch (error) {
      const described = describeCloseError(error);
      if (described.kind !== 'ambiguous') {
        void queryClient.invalidateQueries({ queryKey: ['dispatch'] });
        latest.current.onFail?.(described, described.kind === 'validation');
        return;
      }
      try {
        const page = await queryClient.fetchQuery({
          queryKey: ROUNDS_KEY,
          queryFn: fetchRounds,
          staleTime: 0,
        });
        const current = page.data
          .flatMap((r) => r.orders)
          .find((o) => o.id === id);
        if (current && current.status === 'en_camino')
          latest.current.onFail?.(
            {
              kind: 'ambiguous',
              messages: [
                'El cambio no se registró: puedes intentarlo de nuevo.',
              ],
            },
            true,
          );
        else
          latest.current.onFail?.(
            {
              kind: 'conflict',
              messages: [
                'El pedido ya no está en camino (el cambio sí quedó registrado o alguien más lo cerró); se actualizó la ronda.',
              ],
            },
            false,
          );
      } catch {
        latest.current.onFail?.(described, false);
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return { run, pending };
}
