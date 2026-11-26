'use client';

import { useEffect, useRef, useState } from 'react';
import { requestJson } from '@/lib/api/json';
import { describePasswordError, type PasswordError } from './errors';

export interface ChangePasswordHandlers {
  onDone?: () => void;
  onFail?: (error: PasswordError) => void;
}

/**
 * `PATCH /auth/password` (204). No se reintenta nunca y una marca síncrona frena el doble clic. No hay
 * estado que consultar tras un corte de red: el aviso explica las dos posibilidades. Las contraseñas
 * no se guardan en ningún estado de este hook.
 */
export function useChangePassword(handlers: ChangePasswordHandlers = {}) {
  const busy = useRef(false);
  const latest = useRef(handlers);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    latest.current = handlers;
  });

  async function run(currentPassword: string, newPassword: string) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      await requestJson('/api/auth/password', {
        method: 'PATCH',
        body: { currentPassword, newPassword },
        handleUnauthorized: true,
      });
      latest.current.onDone?.();
    } catch (error) {
      latest.current.onFail?.(describePasswordError(error));
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return { run, pending };
}
