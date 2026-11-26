'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { isApiError } from '@/lib/api/errors';
import { requestJson } from '@/lib/api/json';
import { metricsQuery, type Period } from './period';
import type { Metrics } from './types';

export const METRICS_KEY = ['metrics'] as const;

export function metricsUrl(filters: Period & { zoneId: string | null }) {
  return `/api/metrics?${metricsQuery(filters).toString()}`;
}

/** Métricas del periodo; se consultan, no se transmiten. `enabled` = periodo válido (D-130). */
export function useMetrics(
  filters: Period & { zoneId: string | null },
  enabled: boolean,
) {
  return useQuery<Metrics>({
    queryKey: [...METRICS_KEY, filters.from, filters.to, filters.zoneId],
    queryFn: () =>
      requestJson<Metrics>(metricsUrl(filters), {
        method: 'GET',
        handleUnauthorized: true,
      }),
    enabled,
    placeholderData: keepPreviousData,
    staleTime: 30_000,
    refetchOnWindowFocus: false,
    retry: (count, error) =>
      count < 1 &&
      !(isApiError(error) && error.status >= 400 && error.status < 500),
  });
}
