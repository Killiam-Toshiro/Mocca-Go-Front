'use client';

import { useQuery } from '@tanstack/react-query';
import { isApiError } from '@/lib/api/errors';
import { requestJson } from '@/lib/api/json';
import type { Profile } from './types';

/** Misma clave que usa la cabecera para el nombre: guardar el perfil la actualiza sin otra petición. */
export const PROFILE_KEY = ['customers', 'me'] as const;

export function fetchProfile(): Promise<Profile> {
  return requestJson<Profile>('/api/customers/me', {
    method: 'GET',
    handleUnauthorized: true,
  });
}

/** `GET /customers/me` (solo cliente). */
export function useProfile(enabled = true) {
  return useQuery<Profile>({
    queryKey: PROFILE_KEY,
    queryFn: fetchProfile,
    enabled,
    staleTime: 5 * 60_000,
    retry: (count, error) =>
      count < 1 &&
      !(isApiError(error) && error.status >= 400 && error.status < 500),
  });
}
