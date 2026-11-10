'use client';

import { useQuery } from '@tanstack/react-query';
import { useSession } from '@/components/providers/session-provider';
import { requestJson } from '@/lib/api/json';

/**
 * Nombre para mostrar en pantalla. El personal (admin, operador, repartidor) tiene un
 * usuario legible. Un cliente no: el back le asigna un identificador interno, así que su
 * nombre sale de `GET /customers/me` y, mientras llega o si falla, no se muestra ninguno
 * (nunca el identificador interno).
 */
export function useDisplayName(): string | null {
  const { user } = useSession();
  const isCustomer = user.role === 'cliente';
  const profile = useQuery({
    queryKey: ['customers', 'me'],
    queryFn: () =>
      requestJson<{ fullName?: string }>('/api/customers/me', {
        method: 'GET',
      }),
    enabled: isCustomer,
    staleTime: 5 * 60_000,
    retry: false,
  });

  if (!isCustomer) return user.username;
  const name = profile.data?.fullName?.trim();
  return name ? name : null;
}
