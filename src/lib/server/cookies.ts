import 'server-only';
import {
  SESSION_COOKIE,
  SESSION_COOKIE_SECURE,
  SESSION_EXP_COOKIE,
} from '@/lib/auth/constants';

/** Atributos compatibles con `ResponseCookie` de Next. */
export interface CookieSpec {
  name: string;
  value: string;
  httpOnly: boolean;
  secure: boolean;
  sameSite: 'lax';
  path: '/';
  maxAge: number;
}

/**
 * Con `Secure` el nombre lleva `__Host-`: el navegador exige entonces `Secure`,
 * `Path=/` y ausencia de `Domain`, de modo que ningún subdominio puede fijarla.
 */
export function sessionCookieName(secure: boolean): string {
  return secure ? SESSION_COOKIE_SECURE : SESSION_COOKIE;
}

/** Cookies de sesión: el token (`httpOnly`) y su vencimiento (legible por JS). */
export function buildSessionCookies(
  input: { token: string; expiresIn: number; now?: number },
  secure: boolean,
): { session: CookieSpec; exp: CookieSpec; expiresAt: number } {
  const { token, expiresIn } = input;
  if (!token) throw new Error('El token de sesión está vacío.');
  if (!Number.isInteger(expiresIn) || expiresIn <= 0) {
    throw new Error('expiresIn debe ser un entero positivo de segundos.');
  }
  const expiresAt = (input.now ?? Date.now()) + expiresIn * 1000;
  const base = {
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: expiresIn,
  } as const;
  return {
    session: {
      ...base,
      name: sessionCookieName(secure),
      value: token,
      httpOnly: true,
    },
    exp: {
      ...base,
      name: SESSION_EXP_COOKIE,
      value: String(expiresAt),
      httpOnly: false,
    },
    expiresAt,
  };
}

/** Borra ambas cookies. Se emiten con los mismos atributos de ruta y `Secure`. */
export function clearSessionCookies(secure: boolean): CookieSpec[] {
  const base = {
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
    value: '',
  } as const;
  return [
    { ...base, name: sessionCookieName(secure), httpOnly: true },
    { ...base, name: SESSION_EXP_COOKIE, httpOnly: false },
  ];
}

/** Serializa una cookie para `Set-Cookie` (la pasarela escribe cabeceras sin pasar por `cookies()`). */
export function serializeCookie(cookie: CookieSpec): string {
  const parts = [
    `${cookie.name}=${encodeURIComponent(cookie.value)}`,
    `Max-Age=${cookie.maxAge}`,
    `Path=${cookie.path}`,
  ];
  if (cookie.httpOnly) parts.push('HttpOnly');
  if (cookie.secure) parts.push('Secure');
  parts.push('SameSite=Lax');
  return parts.join('; ');
}

/** Lee una cookie de la cabecera `Cookie` de la petición. */
export function readCookie(
  header: string | null | undefined,
  name: string,
): string | null {
  if (!header) return null;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    if (part.slice(0, index).trim() !== name) continue;
    const raw = part.slice(index + 1).trim();
    try {
      return decodeURIComponent(raw);
    } catch {
      return null;
    }
  }
  return null;
}
