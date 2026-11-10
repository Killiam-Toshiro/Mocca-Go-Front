import { ROLE_HOME, type Role } from './roles';
import { sanitizeReturnPath } from './safe-next';
import type { SessionResult, SessionUser } from './types';

export type Access =
  | { action: 'render'; user: SessionUser; expiresAt: number | null }
  | { action: 'redirect'; to: string }
  | { action: 'unavailable' };

function withNext(base: string, currentPath: string): string {
  const next = sanitizeReturnPath(currentPath);
  return next
    ? `${base}${base.includes('?') ? '&' : '?'}next=${encodeURIComponent(next)}`
    : base;
}

/**
 * Decisión de un layout privado (CA-13). `required` es el rol exigido, o `null` para
 * «cualquier sesión válida». Una sesión muerta pasa por `/api/auth/expired`, que borra
 * las cookies antes de llegar a `/login`: así no hay bucle.
 */
export function decideAccess(
  session: SessionResult,
  required: Role | null,
  currentPath: string,
): Access {
  switch (session.status) {
    case 'none':
      return { action: 'redirect', to: withNext('/login', currentPath) };
    case 'expired':
      return {
        action: 'redirect',
        to: withNext('/api/auth/expired', currentPath),
      };
    case 'error':
      return { action: 'unavailable' };
    case 'ok':
      if (required && session.user.role !== required) {
        return { action: 'redirect', to: ROLE_HOME[session.user.role] };
      }
      return {
        action: 'render',
        user: session.user,
        expiresAt: session.expiresAt,
      };
  }
}

/** `/login` y `/registro`: con sesión válida se va al home del rol; en cualquier otro caso se muestran. */
export function decideAuthPageAccess(session: SessionResult): {
  redirectTo: string | null;
} {
  return {
    redirectTo: session.status === 'ok' ? ROLE_HOME[session.user.role] : null,
  };
}
