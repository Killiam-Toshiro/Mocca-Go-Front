import { callBackend } from '@/lib/server/backend';
import {
  clearSessionCookies,
  readCookie,
  serializeCookie,
  sessionCookieName,
} from '@/lib/server/cookies';
import { getEnv } from '@/lib/server/env';
import { jsonError } from '@/lib/server/errors';
import { checkRequest, requestCarriesBody } from '@/lib/server/origin';
import { clientIpFrom } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Cierra la sesión: revoca en el back (mejor esfuerzo) y SIEMPRE borra las cookies. */
export async function POST(request: Request): Promise<Response> {
  const env = getEnv();
  const guard = checkRequest(
    request.method,
    request.headers,
    env.ALLOWED_ORIGINS,
    await requestCarriesBody(request),
  );
  if (!guard.ok) return jsonError(guard.status, guard.message);

  const token = readCookie(
    request.headers.get('cookie'),
    sessionCookieName(env.COOKIE_SECURE),
  );
  if (token) {
    await callBackend(
      '/auth/logout',
      { method: 'POST', token, clientIp: clientIpFrom(request.headers, env) },
      { env, timeoutMs: 5_000 },
    ).catch(() => undefined);
  }

  const headers = new Headers({ 'Cache-Control': 'no-store' });
  for (const cookie of clearSessionCookies(env.COOKIE_SECURE)) {
    headers.append('Set-Cookie', serializeCookie(cookie));
  }
  return new Response(null, { status: 204, headers });
}
