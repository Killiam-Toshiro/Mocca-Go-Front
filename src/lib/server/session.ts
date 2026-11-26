import 'server-only';
import { cache } from 'react';
import { cookies, headers } from 'next/headers';
import { isRole } from '@/lib/auth/roles';
import { SESSION_EXP_COOKIE } from '@/lib/auth/constants';
import type { SessionResult, SessionUser } from '@/lib/auth/types';
import { BackendError, callBackend, type BackendOptions } from './backend';
import { resolveClientIp } from './client-ip';
import { sessionCookieName } from './cookies';
import { getEnv, type AppEnv } from './env';

export function parseMe(body: unknown): SessionUser | null {
  if (typeof body !== 'object' || body === null) return null;
  const { id, username, role } = body as Record<string, unknown>;
  if (typeof id !== 'string' || typeof username !== 'string' || !isRole(role))
    return null;
  return { id, username, role };
}

/** `session_exp` → epoch ms, o `null` si falta o no es un número válido. */
export function parseExpiry(raw: string | null | undefined): number | null {
  if (!raw || !/^\d{1,15}$/.test(raw)) return null;
  const value = Number(raw);
  return value > 0 ? value : null;
}

/** Valida el token con `GET /auth/me`. */
export async function fetchSession(
  token: string | null | undefined,
  expiresAt: string | null | undefined,
  context: { clientIp?: string | null } & BackendOptions,
): Promise<SessionResult> {
  if (!token) return { status: 'none' };
  try {
    const response = await callBackend(
      '/auth/me',
      { token, clientIp: context.clientIp ?? null },
      context,
    );
    if (response.status === 401) return { status: 'expired' };
    if (!response.ok) return { status: 'error' };
    const user = parseMe(await response.json().catch(() => null));
    return user
      ? { status: 'ok', user, expiresAt: parseExpiry(expiresAt) }
      : { status: 'error' };
  } catch (error) {
    if (error instanceof BackendError) return { status: 'error' };
    throw error;
  }
}

export function clientIpFrom(
  headersList: Headers,
  env: Pick<AppEnv, 'TRUST_PROXY_HOPS'>,
): string | null {
  return resolveClientIp(
    headersList.get('x-forwarded-for'),
    env.TRUST_PROXY_HOPS,
  );
}

/** Sesión de la petición en curso (una sola consulta al back por petición, aunque la pidan varios layouts). */
export const getSession = cache(async (): Promise<SessionResult> => {
  const env = getEnv();
  const jar = await cookies();
  const token = jar.get(sessionCookieName(env.COOKIE_SECURE))?.value;
  const expiresAt = jar.get(SESSION_EXP_COOKIE)?.value;
  return fetchSession(token, expiresAt, {
    env,
    clientIp: clientIpFrom(await headers(), env),
  });
});
