'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { requestJson } from '@/lib/api/json';
import { samePhone } from '@/lib/profile/schemas';
import {
  AMBIGUOUS_PASSWORD_RESET,
  describeUserError,
  type UserError,
} from './errors';
import type { EditValues } from './schemas';
import type { User } from './types';
import { fetchUsers, USERS_KEY } from './use-users';

export type UserChanges = Partial<EditValues> & { password?: string };

export interface UpdateUserHandlers {
  onDone?: (user: User, how: 'sent' | 'recovered') => void;
  onFail?: (error: UserError) => void;
}

/**
 * `PATCH /users/{id}` con **solo lo que cambió**. Marca síncrona contra el doble clic, sin reintento
 * automático; tras un corte de red se consulta el usuario y se compara. Una contraseña no se puede
 * comprobar: si solo se cambió eso, el aviso explica las dos posibilidades (DP-07, DP-09).
 */
export function useUpdateUser(handlers: UpdateUserHandlers = {}) {
  const queryClient = useQueryClient();
  const busy = useRef(false);
  const latest = useRef(handlers);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    latest.current = handlers;
  });

  async function run(user: User, changes: UserChanges) {
    if (Object.keys(changes).length === 0 || busy.current) return;
    busy.current = true;
    setPending(true);
    const onlyPassword = Object.keys(changes).every((k) => k === 'password');
    const ambiguous = onlyPassword ? AMBIGUOUS_PASSWORD_RESET : undefined;
    try {
      const updated = await requestJson<User>(`/api/users/${user.id}`, {
        method: 'PATCH',
        body: changes,
        handleUnauthorized: true,
      });
      void queryClient.invalidateQueries({ queryKey: USERS_KEY });
      latest.current.onDone?.(updated, 'sent');
    } catch (error) {
      const described = describeUserError(error, ambiguous);
      if (described.kind !== 'ambiguous' || onlyPassword) {
        latest.current.onFail?.(described);
        return;
      }
      try {
        const page = await fetchUsers(
          {
            page: 1,
            search: changes.username ?? user.username,
            role: 'todos',
          },
          100,
        );
        const found = page.data.find((u) =>
          changes.username ? u.username === changes.username : u.id === user.id,
        );
        const applied =
          found !== undefined &&
          (changes.username === undefined ||
            found.username === changes.username) &&
          (changes.fullName === undefined ||
            found.fullName === changes.fullName) &&
          (changes.phone === undefined ||
            (found.phone !== null && samePhone(found.phone, changes.phone))) &&
          changes.password === undefined;
        if (found && applied) {
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
