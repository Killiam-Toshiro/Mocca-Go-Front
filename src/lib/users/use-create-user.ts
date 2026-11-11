'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { requestJson } from '@/lib/api/json';
import { describeUserError, type UserError } from './errors';
import { createBody, type CreateUserValues } from './schemas';
import type { User } from './types';
import { fetchUsers, USERS_KEY } from './use-users';

export interface CreateUserHandlers {
  /** `recovered`: se creó pero la respuesta se perdió; se encontró al consultar. */
  onDone?: (user: User, how: 'sent' | 'recovered') => void;
  onFail?: (error: UserError) => void;
}

/**
 * `POST /users`. Una marca síncrona frena el doble clic; no se reintenta solo (no es idempotente) y
 * tras un corte de red se busca el usuario por su nombre antes de ofrecer «Reintentar» (D-070, DP-07).
 */
export function useCreateUser(handlers: CreateUserHandlers = {}) {
  const queryClient = useQueryClient();
  const busy = useRef(false);
  const latest = useRef(handlers);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    latest.current = handlers;
  });

  async function run(values: CreateUserValues) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    const body = createBody(values);
    try {
      const user = await requestJson<User>('/api/users', {
        method: 'POST',
        body,
        handleUnauthorized: true,
      });
      void queryClient.invalidateQueries({ queryKey: USERS_KEY });
      latest.current.onDone?.(user, 'sent');
    } catch (error) {
      const described = describeUserError(error);
      if (described.kind !== 'ambiguous') {
        latest.current.onFail?.(described);
        return;
      }
      try {
        const page = await fetchUsers(
          { page: 1, search: body.username, role: 'todos' },
          100,
        );
        const found = page.data.find((u) => u.username === body.username);
        if (found) {
          void queryClient.invalidateQueries({ queryKey: USERS_KEY });
          latest.current.onDone?.(found, 'recovered');
        } else latest.current.onFail?.(described);
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
