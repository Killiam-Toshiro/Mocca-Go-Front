import { SESSION_EXP_COOKIE } from '@/lib/auth/constants';
import {
  clearSessionCookies,
  readCookie,
  serializeCookie,
  sessionCookieName,
} from '@/lib/server/cookies';
import { getEnv } from '@/lib/server/env';
import { jsonError, jsonResponse } from '@/lib/server/errors';
import { clientIpFrom, fetchSession } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Quién soy: valida la cookie con `/auth/me`. Sesión muerta → 401 y se borran las cookies. */
export async function GET(request: Request): Promise<Response> {
  const env = getEnv();
  const cookieHeader = request.headers.get('cookie');
  const session = await fetchSession(
    readCookie(cookieHeader, sessionCookieName(env.COOKIE_SECURE)),
    readCookie(cookieHeader, SESSION_EXP_COOKIE),
    { env, clientIp: clientIpFrom(request.headers, env) },
  );

  switch (session.status) {
    case 'ok':
      return jsonResponse({ user: session.user, expiresAt: session.expiresAt });
    case 'none':
      return jsonError(401, 'Sesión no iniciada o vencida.');
    case 'expired': {
      const headers = new Headers();
      for (const cookie of clearSessionCookies(env.COOKIE_SECURE)) {
        headers.append('Set-Cookie', serializeCookie(cookie));
      }
      return jsonError(401, 'Sesión no iniciada o vencida.', headers);
    }
    case 'error':
      return jsonError(502, 'No pudimos conectar con el servidor.');
  }
}
