'use client';

import {
  keepPreviousData,
  useQuery,
  type QueryClient,
} from '@tanstack/react-query';
import { isApiError } from '@/lib/api/errors';
import { requestJson } from '@/lib/api/json';
import type { CategoryFilter, StateFilter } from './categories';
import type { Product, ProductPage } from './types';

export const CATALOG_PAGE_SIZE = 20;
export const CATALOG_KEY = ['catalog'] as const;

export interface CatalogFilter {
  page: number;
  /** Texto ya recortado y con espera; vacío = sin búsqueda. */
  search: string;
  category: CategoryFilter;
  state: StateFilter;
}

export function catalogUrl(
  filter: CatalogFilter,
  limit: number = CATALOG_PAGE_SIZE,
): string {
  const params = new URLSearchParams({
    page: String(filter.page),
    limit: String(limit),
  });
  const search = filter.search.trim();
  if (search) params.set('search', search);
  if (filter.category !== 'todas') params.set('category', filter.category);
  if (filter.state !== 'todos')
    params.set('active', filter.state === 'activos' ? 'true' : 'false');
  return `/api/products?${params.toString()}`;
}

export function fetchCatalog(
  filter: CatalogFilter,
  limit?: number,
): Promise<ProductPage> {
  return requestJson<ProductPage>(catalogUrl(filter, limit), {
    method: 'GET',
    handleUnauthorized: true,
  });
}

/** Busca por SKU exacto (el back busca por texto parcial): sirve para confirmar tras un corte de red. */
export async function findBySku(sku: string): Promise<Product | null> {
  const page = await fetchCatalog(
    { page: 1, search: sku, category: 'todas', state: 'todos' },
    100,
  );
  return page.data.find((p) => p.sku === sku) ?? null;
}

/** Tras cualquier cambio del catálogo: la lista del admin, «Productos» del operador y el menú. */
export function invalidateCatalog(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: CATALOG_KEY });
  void queryClient.invalidateQueries({ queryKey: ['products'] });
  void queryClient.invalidateQueries({ queryKey: ['menu'] });
}

export function useCatalog(filter: CatalogFilter) {
  return useQuery<ProductPage>({
    queryKey: [
      ...CATALOG_KEY,
      filter.page,
      filter.search.trim(),
      filter.category,
      filter.state,
    ],
    queryFn: () => fetchCatalog(filter),
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    retry: (count, error) =>
      count < 1 &&
      !(isApiError(error) && error.status >= 400 && error.status < 500),
  });
}

/** Opciones para armar un combo: productos simples y activos que coinciden con la búsqueda. */
export function useComponentOptions(search: string, enabled: boolean) {
  const text = search.trim();
  return useQuery<Product[]>({
    queryKey: [...CATALOG_KEY, 'options', text],
    enabled,
    queryFn: async () => {
      const params = new URLSearchParams({ limit: '100', active: 'true' });
      if (text) params.set('search', text);
      const page = await requestJson<ProductPage>(
        `/api/products?${params.toString()}`,
        { method: 'GET', handleUnauthorized: true },
      );
      return page.data.filter((p) => p.category !== 'combo');
    },
    placeholderData: keepPreviousData,
    retry: (count, error) =>
      count < 1 &&
      !(isApiError(error) && error.status >= 400 && error.status < 500),
  });
}

/** Combos que contienen un producto: la confirmación de desactivar avisa de cuáles dejarán de estar disponibles. */
export function useCombosWith(productId: string, enabled: boolean) {
  return useQuery<Product[]>({
    queryKey: [...CATALOG_KEY, 'combos-with', productId],
    enabled,
    staleTime: 0,
    queryFn: async () => {
      const page = await requestJson<ProductPage>(
        '/api/products?category=combo&limit=100',
        { method: 'GET', handleUnauthorized: true },
      );
      return page.data.filter((combo) =>
        combo.components.some((c) => c.productId === productId),
      );
    },
    retry: false,
  });
}
