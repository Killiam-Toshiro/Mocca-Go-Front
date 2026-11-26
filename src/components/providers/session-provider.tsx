'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from 'react';
import type { SessionUser } from '@/lib/auth/types';
import { MAX_TIMER_MS, parseExpiryCookie } from '@/lib/auth/session-client';
import { useExpireSession } from './query-provider';

interface SessionContextValue {
  user: SessionUser;
  /** Epoch ms en que vence la sesión, si se conoce. */
  expiresAt: number | null;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function useSession(): SessionContextValue {
  const value = useContext(SessionContext);
  if (!value)
    throw new Error('useSession debe usarse dentro de <SessionProvider>.');
  return value;
}

/**
 * Entrega el usuario (ya validado por el servidor) a los componentes cliente y vigila
 * el vencimiento: al llegar la hora lleva a `/login?expired=1`. No hay refresh en el back.
 */
export function SessionProvider({
  user,
  expiresAt,
  children,
}: SessionContextValue & { children: ReactNode }) {
  const expire = useExpireSession();
  const value = useMemo(() => ({ user, expiresAt }), [user, expiresAt]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      clearTimeout(timer);
      // La cookie manda: un inicio de sesión en otra pestaña la renueva.
      const deadline = parseExpiryCookie(document.cookie) ?? expiresAt;
      if (deadline === null) return;
      const remaining = deadline - Date.now();
      if (remaining <= 0) return expire();
      timer = setTimeout(schedule, Math.min(remaining, MAX_TIMER_MS));
    };

    // Los temporizadores se retrasan en pestañas ocultas: se revisa al volver.
    const onVisible = () => {
      if (document.visibilityState === 'visible') schedule();
    };

    schedule();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [expiresAt, expire]);

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
