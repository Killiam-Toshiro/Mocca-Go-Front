import { SESSION_EXP_COOKIE } from './constants';

/** `setTimeout` no admite más de 2^31-1 ms; se reprograma al llegar. */
export const MAX_TIMER_MS = 2_000_000_000;

/** Lee `session_exp` (epoch ms) de `document.cookie`. Nunca contiene el token. */
export function parseExpiryCookie(cookieString: string): number | null {
  for (const part of cookieString.split(';')) {
    const index = part.indexOf('=');
    if (index === -1 || part.slice(0, index).trim() !== SESSION_EXP_COOKIE)
      continue;
    const raw = part.slice(index + 1).trim();
    if (!/^\d{1,15}$/.test(raw)) return null;
    const value = Number(raw);
    return value > 0 ? value : null;
  }
  return null;
}
