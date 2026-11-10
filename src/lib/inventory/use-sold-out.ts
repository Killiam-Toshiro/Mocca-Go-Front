'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { requestJson } from '@/lib/api/json';
import type { components } from '@/lib/api/schema';
import { toStaffProduct, type ProductPage, type StaffProduct } from './types';

/**
 * `PATCH /products/:id/sold-out` (idempotente). La fila se actualiza con la respuesta del back y
 * luego se vuelve a consultar el catálogo para que el back confirme (D-067).
 */
export function useSetSoldOut(
  /** Se llama con el producto ya actualizado (aunque la fila ya no exista). */
  onDone?: (product: StaffProduct) => void,
  /** Se llama con el error (p. ej. 404) aunque la fila ya no exista. */
  onFail?: (error: unknown) => void,
) {
  const queryClient = useQueryClient();
  return useMutation<StaffProduct, Error, { id: string; soldOut: boolean }>({
    retry: false,
    mutationFn: async ({ id, soldOut }) =>
      toStaffProduct(
        await requestJson<components['schemas']['ProductResponse']>(
          `/api/products/${encodeURIComponent(id)}/sold-out`,
          {
            method: 'PATCH',
            body: { soldOut },
            handleUnauthorized: true,
          },
        ),
      ),
    onSuccess: (product) => {
      queryClient.setQueryData<ProductPage>(['products'], (page) =>
        page
          ? {
              ...page,
              data: page.data.map((p) => (p.id === product.id ? product : p)),
            }
          : page,
      );
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      onDone?.(product);
    },
    onError: (error) => {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      onFail?.(error);
    },
  });
}
