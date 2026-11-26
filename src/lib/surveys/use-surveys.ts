'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { isApiError } from '@/lib/api/errors';
import { requestJson } from '@/lib/api/json';
import type { components } from '@/lib/api/schema';
import { SURVEYS_PAGE_SIZE, type SurveyFilters } from './filters';

export type SurveyPage = components['schemas']['SurveyPageResponse'];
export type SurveyRow = components['schemas']['SurveyRowResponse'];
export const SURVEYS_KEY = ['surveys'] as const;

export function surveysUrl(
  f: SurveyFilters,
  limit = SURVEYS_PAGE_SIZE,
): string {
  const q = new URLSearchParams({
    page: String(f.page),
    limit: String(limit),
  });
  if (f.rating) q.set('rating', String(f.rating));
  if (f.from) q.set('from', f.from);
  if (f.to) q.set('to', f.to);
  return `/api/surveys?${q.toString()}`;
}

/** Respuestas de la encuesta, la más reciente primero (D-131). `enabled` = fechas válidas. */
export function useSurveys(filters: SurveyFilters) {
  return useQuery<SurveyPage>({
    queryKey: [
      ...SURVEYS_KEY,
      filters.page,
      filters.rating,
      filters.from,
      filters.to,
    ],
    queryFn: () =>
      requestJson<SurveyPage>(surveysUrl(filters), {
        method: 'GET',
        handleUnauthorized: true,
      }),
    enabled: filters.error === null,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: false,
    retry: (count, error) =>
      count < 1 &&
      !(isApiError(error) && error.status >= 400 && error.status < 500),
  });
}
