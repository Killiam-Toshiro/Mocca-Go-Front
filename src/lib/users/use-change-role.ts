'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { requestJson } from '@/lib/api/json';
import { describeUserError, type UserError } from './errors';
import type { StaffRole, User } from './types';
import { fetchUsers, USERS_KEY } from './use-users';

export interface ChangeRoleHandlers {
  onDone?: (user: User, how: 'sent' | 'recovered') => void;
  onFail?: (error: UserError) => void;
}

/**
 * `PATCH /users/{id}/role`. Si el nuevo rol es repartidor y faltan nombre o celular, primero se
 * guardan (`PATCH /users/{id}`) porque el back los exige ya guardados. Cambiar el rol cierra las
 * sesiones del usuario (su siguiente petición da 401). Sin reintento automático; tras un corte de red
 * se consulta el usuario y se confirma (DP-05, DP-07).
 */
export function useChangeRole(handlers: ChangeRoleHandlers = {}) {
  const queryClient = useQueryClient();
  const busy = useRef(false);
  const latest = useRef(handlers);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    latest.current = handlers;
  });

  async function run(
    user: User,
    role: StaffRole,
    contact?: { fullName?: string; phone?: string },
  ) {
    if (busy.current || user.role === role) return;
    busy.current = true;
    setPending(true);
    try {
      if (contact && Object.keys(contact).length > 0)
        await requestJson<User>(`/api/users/${user.id}`, {
          method: 'PATCH',
          body: contact,
          handleUnauthorized: true,
        });
      const updated = await requestJson<User>(`/api/users/${user.id}/role`, {
        method: 'PATCH',
        body: { role },
        handleUnauthorized: true,
      });
      void queryClient.invalidateQueries({ queryKey: USERS_KEY });
      latest.current.onDone?.(updated, 'sent');
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
        const found = page.data.find((u) => u.id === user.id);
        if (found?.role === role) latest.current.onDone?.(found, 'recovered');
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
