'use client';

import { useQuery } from '@tanstack/react-query';
import { isApiError } from '@/lib/api/errors';
import { requestJson } from '@/lib/api/json';
import type { components } from '@/lib/api/schema';
import { toStaffProduct, type ProductPage } from './types';

export const PRODUCTS_POLL_MS = 30_000;
export const PRODUCTS_LIMIT = 100;

/** Trae el catálogo completo (hasta 100) sin el costo (D-070). */
export async function fetchProducts(): Promise<ProductPage> {
  const page = await requestJson<components['schemas']['ProductPageResponse']>(
    `/api/products?limit=${String(PRODUCTS_LIMIT)}`,
    { method: 'GET', handleUnauthorized: true },
  );
  return { ...page, data: page.data.map(toStaffProduct) };
}

/**
 * El catálogo completo (hasta 100) para el personal. Sin canal en vivo: se vuelve a consultar
 * cada 30 s mientras la pestaña está visible y al volver a ella (D-069). El costo se descarta aquí.
 */
export function useProducts() {
  return useQuery<ProductPage>({
    queryKey: ['products'],
    queryFn: fetchProducts,
    refetchInterval: PRODUCTS_POLL_MS,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
    retry: (count, error) =>
      count < 1 &&
      !(isApiError(error) && error.status >= 400 && error.status < 500),
  });
}
