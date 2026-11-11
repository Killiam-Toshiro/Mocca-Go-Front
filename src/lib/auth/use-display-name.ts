'use client';

import { useSession } from '@/components/providers/session-provider';
import { useProfile } from '@/lib/profile/use-profile';

/**
 * Nombre para mostrar en pantalla. El personal (admin, operador, repartidor) tiene un
 * usuario legible. Un cliente no: el back le asigna un identificador interno, así que su
 * nombre sale de `GET /customers/me` y, mientras llega o si falla, no se muestra ninguno
 * (nunca el identificador interno).
 */
export function useDisplayName(): string | null {
  const { user } = useSession();
  const isCustomer = user.role === 'cliente';
  const profile = useProfile(isCustomer);

  if (!isCustomer) return user.username;
  const name = profile.data?.fullName.trim();
  return name ? name : null;
}
