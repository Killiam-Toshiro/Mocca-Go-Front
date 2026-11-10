import { canAccess, ROLE_HOME, type Role } from './roles';

const BASE = 'http://safe-next.invalid';

/**
 * Valida el parámetro `next` (CA-14): debe ser una ruta interna y el rol debe poder
 * entrar. Devuelve la ruta normalizada (`/cliente/../admin` → `/admin`) o `null`.
 */
export function parseSafeNext(
  next: string | null | undefined,
  role: Role,
): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  // Barras invertidas y caracteres de control (el navegador los quita o los convierte en `/`).
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return null;

  let url: URL;
  try {
    url = new URL(next, BASE);
  } catch {
    return null;
  }
  if (url.origin !== BASE) return null;
  if (!canAccess(role, url.pathname)) return null;
  return `${url.pathname}${url.search}`;
}

/** Destino tras iniciar sesión: `next` si es seguro y permitido; si no, el home del rol. */
export function resolveNext(
  next: string | null | undefined,
  role: Role,
): string {
  return parseSafeNext(next, role) ?? ROLE_HOME[role];
}

/** Ruta interna cualquiera (para volver tras una sesión vencida, antes de conocer el rol). */
export function sanitizeReturnPath(
  next: string | null | undefined,
): string | null {
  if (!next || !next.startsWith('/') || next.startsWith('//')) return null;
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return null;
  try {
    const url = new URL(next, BASE);
    return url.origin === BASE ? `${url.pathname}${url.search}` : null;
  } catch {
    return null;
  }
}
