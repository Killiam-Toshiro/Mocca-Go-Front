'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { isApiError } from '@/lib/api/errors';
import { requestJson } from '@/lib/api/json';
import type { Round, RoundPage } from '@/lib/dispatch/types';
import type { RoundFilter } from './filters';

export const STAFF_ROUNDS_PAGE_SIZE = 20;
/** No hay canal en vivo de rondas para el personal: se consulta cada 15 s, solo con la pestaña visible (D-122). */
export const ROUNDS_POLL_MS = 15_000;

const retry = (count: number, error: unknown) =>
  count < 1 &&
  !(isApiError(error) && error.status >= 400 && error.status < 500);

export function staffRoundsUrl(page: number, status: RoundFilter): string {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(STAFF_ROUNDS_PAGE_SIZE),
  });
  if (status !== 'todas') params.set('status', status);
  return `/api/dispatch/rounds?${params.toString()}`;
}

export function useStaffRounds(page: number, status: RoundFilter) {
  return useQuery<RoundPage>({
    queryKey: ['staff-rounds', page, status],
    queryFn: () =>
      requestJson<RoundPage>(staffRoundsUrl(page, status), {
        method: 'GET',
        handleUnauthorized: true,
      }),
    placeholderData: keepPreviousData,
    refetchInterval: ROUNDS_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry,
  });
}

export function useStaffRound(id: string) {
  return useQuery<Round>({
    queryKey: ['staff-round', id],
    queryFn: () =>
      requestJson<Round>(`/api/dispatch/rounds/${encodeURIComponent(id)}`, {
        method: 'GET',
        handleUnauthorized: true,
      }),
    refetchInterval: ROUNDS_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry,
  });
}
