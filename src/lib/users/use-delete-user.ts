'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { requestJson } from '@/lib/api/json';
import { describeUserError, type UserError } from './errors';
import type { User } from './types';
import { fetchUsers, USERS_KEY } from './use-users';

export interface DeleteUserHandlers {
  /** `recovered`: la respuesta se perdió pero el usuario ya no está. */
  onDone?: (how: 'sent' | 'recovered') => void;
  onFail?: (error: UserError) => void;
}

/**
 * `DELETE /users/{id}` (204). Marca síncrona, sin reintento automático; tras un corte de red, si el
 * usuario ya no aparece se da por eliminado (DP-06, DP-07).
 */
export function useDeleteUser(handlers: DeleteUserHandlers = {}) {
  const queryClient = useQueryClient();
  const busy = useRef(false);
  const latest = useRef(handlers);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    latest.current = handlers;
  });

  async function run(user: User) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      await requestJson(`/api/users/${user.id}`, {
        method: 'DELETE',
        handleUnauthorized: true,
      });
      void queryClient.invalidateQueries({ queryKey: USERS_KEY });
      latest.current.onDone?.('sent');
    } catch (error) {
      const described = describeUserError(error);
      void queryClient.invalidateQueries({ queryKey: USERS_KEY });
      if (described.kind !== 'ambiguous') {
        latest.current.onFail?.(described);
        return;
      }
      try {
        const page = await fetchUsers(
          { page: 1, search: user.username, role: 'todos' },
          100,
        );
        if (!page.data.some((u) => u.id === user.id))
          latest.current.onDone?.('recovered');
        else latest.current.onFail?.(described);
      } catch {
        latest.current.onFail?.(described);
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return { run, pending };
}
