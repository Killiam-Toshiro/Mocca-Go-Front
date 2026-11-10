'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { requestJson } from '@/lib/api/json';
import type { CreatedMovement, MovementInput, ProductPage } from './types';

/**
 * `POST /movements`. **No es idempotente** y no se reintenta nunca (D-068). Con la respuesta se
 * ajusta el saldo de la fila (`stock` confirmado por el back) y se vuelve a consultar todo.
 */
export function useCreateMovement(
  onDone?: (created: CreatedMovement) => void,
  onFail?: (error: unknown) => void,
) {
  const queryClient = useQueryClient();
  return useMutation<
    CreatedMovement,
    Error,
    MovementInput & { productId: string }
  >({
    retry: false,
    mutationFn: (input) =>
      requestJson<CreatedMovement>('/api/movements', {
        method: 'POST',
        body: input,
        handleUnauthorized: true,
      }),
    onSuccess: (created) => {
      queryClient.setQueryData<ProductPage>(['products'], (page) =>
        page
          ? {
              ...page,
              data: page.data.map((p) =>
                p.id === created.movement.productId
                  ? { ...p, stock: created.stock }
                  : p,
              ),
            }
          : page,
      );
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['movements'] });
      onDone?.(created);
    },
    onError: (error) => {
      // El saldo pudo cambiar (o el movimiento registrarse): se trae lo que hay.
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['movements'] });
      onFail?.(error);
    },
  });
}
