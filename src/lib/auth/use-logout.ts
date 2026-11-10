'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { requestJson } from '@/lib/api/json';
import { navigate } from '@/lib/browser';

/**
 * Cierra la sesión: el servidor revoca el token y borra las cookies. Pase lo que pase
 * (incluso si la llamada falla) se vacía la caché y se va a `/login`.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await requestJson('/api/auth/logout').catch(() => undefined);
    },
    onSettled: () => {
      queryClient.clear();
      navigate('/login');
    },
  });
}
