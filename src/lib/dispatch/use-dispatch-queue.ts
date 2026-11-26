'use client';

import { useQuery } from '@tanstack/react-query';
import { isApiError } from '@/lib/api/errors';
import { requestJson } from '@/lib/api/json';
import { kitchenRefetchInterval } from '@/lib/kitchen/use-kitchen-queue';
import { useLiveStatus } from '@/lib/live/channel';
import type { Queue, RoundPage } from './types';

export const QUEUE_KEY = ['dispatch', 'queue'] as const;
export const ROUNDS_KEY = ['dispatch', 'rounds'] as const;
/** Una ronda activa por repartidor: 2 como máximo; se pide con holgura. */
export const ROUNDS_LIMIT = 20;

export const fetchQueue = () =>
  requestJson<Queue>('/api/dispatch/queue', {
    method: 'GET',
    handleUnauthorized: true,
  });

export const fetchRounds = () =>
  requestJson<RoundPage>(
    `/api/dispatch/rounds?status=activa&limit=${String(ROUNDS_LIMIT)}`,
    { method: 'GET', handleUnauthorized: true },
  );

const retry = (count: number, error: unknown) =>
  count < 1 &&
  !(isApiError(error) && error.status >= 400 && error.status < 500);

/** Cola de despacho: pedidos listos por zona. Con el canal en vivo no hay sondeo (D-052). */
export function useDispatchQueue() {
  const live = useLiveStatus();
  return useQuery<Queue>({
    queryKey: QUEUE_KEY,
    queryFn: fetchQueue,
    refetchInterval: kitchenRefetchInterval(live),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry,
  });
}

/** Rondas activas del repartidor (máximo 2 en el back). */
export function useActiveRounds() {
  const live = useLiveStatus();
  return useQuery<RoundPage>({
    queryKey: ROUNDS_KEY,
    queryFn: fetchRounds,
    refetchInterval: kitchenRefetchInterval(live),
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry,
  });
}
