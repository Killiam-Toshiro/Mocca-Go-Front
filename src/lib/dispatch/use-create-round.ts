'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { requestJson } from '@/lib/api/json';
import {
  AMBIGUOUS_ROUND,
  describeCreateRoundError,
  type DispatchError,
} from './errors';
import type { Queue, Round, RoundPage } from './types';
import { fetchRounds, QUEUE_KEY, ROUNDS_KEY } from './use-dispatch-queue';

export interface CreateRoundHandlers {
  /** `recovered`: la ronda salió pero la respuesta se perdió; se encontró al consultar. */
  onDone?: (round: Round, recovered: boolean) => void;
  onFail?: (error: DispatchError) => void;
}

/**
 * `POST /dispatch/rounds` con `{}` (la sugerencia) o `{ orderIds }`. **No es idempotente**: no se
 * reintenta nunca y una marca síncrona frena el doble clic. Tras un corte de red o un 5xx se
 * consultan las rondas antes de decir si salió (D-070).
 */
export function useCreateRound(handlers: CreateRoundHandlers = {}) {
  const queryClient = useQueryClient();
  const busy = useRef(false);
  const latest = useRef(handlers);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    latest.current = handlers;
  });

  function applyCreated(round: Round) {
    queryClient.setQueryData<RoundPage>(ROUNDS_KEY, (page) =>
      page && !page.data.some((r) => r.id === round.id)
        ? { ...page, total: page.total + 1, data: [round, ...page.data] }
        : page,
    );
    const taken = new Set(round.orders.map((o) => o.id));
    queryClient.setQueryData<Queue>(QUEUE_KEY, (queue) =>
      queue
        ? {
            ...queue,
            zones: queue.zones
              .map((z) => ({
                ...z,
                orders: z.orders.filter((o) => !taken.has(o.id)),
              }))
              .filter((z) => z.orders.length > 0),
          }
        : queue,
    );
    void queryClient.invalidateQueries({ queryKey: ['dispatch'] });
  }

  async function run(orderIds?: string[]): Promise<void> {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    const before = new Set(
      queryClient.getQueryData<RoundPage>(ROUNDS_KEY)?.data.map((r) => r.id) ??
        [],
    );
    try {
      const round = await requestJson<Round>('/api/dispatch/rounds', {
        method: 'POST',
        body: orderIds ? { orderIds } : {},
        handleUnauthorized: true,
      });
      applyCreated(round);
      latest.current.onDone?.(round, false);
    } catch (error) {
      const described = describeCreateRoundError(error);
      if (described.kind !== 'ambiguous') {
        void queryClient.invalidateQueries({ queryKey: ['dispatch'] });
        latest.current.onFail?.(described);
        return;
      }
      try {
        const page = await queryClient.fetchQuery({
          queryKey: ROUNDS_KEY,
          queryFn: fetchRounds,
          staleTime: 0,
        });
        void queryClient.invalidateQueries({ queryKey: QUEUE_KEY });
        const fresh = page.data.find((r) => !before.has(r.id));
        if (fresh) latest.current.onDone?.(fresh, true);
        else
          latest.current.onFail?.({
            kind: 'ambiguous',
            messages: ['La ronda no salió: puedes intentar de nuevo.'],
          });
      } catch {
        latest.current.onFail?.({
          kind: 'ambiguous',
          messages: [AMBIGUOUS_ROUND],
        });
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return { run, pending };
}
