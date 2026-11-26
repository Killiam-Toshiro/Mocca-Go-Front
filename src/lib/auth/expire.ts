import { sanitizeReturnPath } from './safe-next';

/**
 * Destino cuando la sesión terminó. Pasa por `/api/auth/expired` para que el servidor
 * borre las cookies antes de mostrar `/login`: sin cookies no hay bucle.
 */
export function buildExpiredUrl(currentPath: string): string {
  const next = sanitizeReturnPath(currentPath);
  return next
    ? `/api/auth/expired?next=${encodeURIComponent(next)}`
    : '/api/auth/expired';
}

/** Las páginas públicas de acceso no deben redirigirse a sí mismas. */
export function isAuthPagePath(pathname: string): boolean {
  return pathname === '/login' || pathname === '/registro';
}
