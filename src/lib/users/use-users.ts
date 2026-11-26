'use client';

import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { isApiError } from '@/lib/api/errors';
import { requestJson } from '@/lib/api/json';
import { roleParam, type RoleFilter } from './roles';
import type { UserPage } from './types';

export const USERS_PAGE_SIZE = 20;
export const USERS_KEY = ['users'] as const;

export interface UsersFilter {
  page: number;
  /** Texto ya recortado y con espera; vacío = sin búsqueda. */
  search: string;
  role: RoleFilter;
}

export function usersUrl(
  filter: UsersFilter,
  limit: number = USERS_PAGE_SIZE,
): string {
  const params = new URLSearchParams({
    page: String(filter.page),
    limit: String(limit),
  });
  const search = filter.search.trim();
  if (search) params.set('search', search);
  const role = roleParam(filter.role);
  if (role) params.set('role', role);
  return `/api/users?${params.toString()}`;
}

export function fetchUsers(
  filter: UsersFilter,
  limit?: number,
): Promise<UserPage> {
  return requestJson<UserPage>(usersUrl(filter, limit), {
    method: 'GET',
    handleUnauthorized: true,
  });
}

/** Lista de usuarios paginada, con búsqueda y filtro en el servidor; conserva la página anterior al cambiar. */
export function useUsers(filter: UsersFilter) {
  return useQuery<UserPage>({
    queryKey: [...USERS_KEY, filter.page, filter.search.trim(), filter.role],
    queryFn: () => fetchUsers(filter),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    retry: (count, error) =>
      count < 1 &&
      !(isApiError(error) && error.status >= 400 && error.status < 500),
  });
}
