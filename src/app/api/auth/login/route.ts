import {
  backendErrorResponse,
  BackendError,
  callBackend,
  relayBackendError,
} from '@/lib/server/backend';
import { buildSessionCookies, serializeCookie } from '@/lib/server/cookies';
import { getEnv } from '@/lib/server/env';
import { jsonError, jsonResponse } from '@/lib/server/errors';
import { checkRequest, requestCarriesBody } from '@/lib/server/origin';
import { clientIpFrom, fetchSession } from '@/lib/server/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Solo estos campos viajan al back; cualquier otro se descarta. */
function pickCredentials(body: unknown): Record<string, unknown> | null {
  if (typeof body !== 'object' || body === null || Array.isArray(body))
    return null;
  const source = body as Record<string, unknown>;
  const picked: Record<string, unknown> = {};
  for (const key of ['username', 'email', 'password']) {
    // Un valor que no sea texto se envía tal cual: el back lo rechaza con su propio mensaje.
    if (source[key] !== undefined) picked[key] = source[key];
  }
  return picked;
}

function isLoginPayload(
  value: unknown,
): value is { accessToken: string; expiresIn: number } {
  if (typeof value !== 'object' || value === null) return false;
  const { accessToken, expiresIn } = value as Record<string, unknown>;
  return (
    typeof accessToken === 'string' &&
    accessToken.length > 0 &&
    typeof expiresIn === 'number' &&
    Number.isInteger(expiresIn) &&
    expiresIn > 0
  );
}

/**
 * Inicio de sesión (BFF): el token del back se guarda en cookies `httpOnly` y
 * nunca se devuelve en el cuerpo. El rol se obtiene de `/auth/me` (D-010).
 */
export async function POST(request: Request): Promise<Response> {
  const env = getEnv();
  const guard = checkRequest(
    request.method,
    request.headers,
    env.ALLOWED_ORIGINS,
    await requestCarriesBody(request),
  );
  if (!guard.ok) return jsonError(guard.status, guard.message);

  const credentials = pickCredentials(await request.json().catch(() => null));
  if (!credentials)
    return jsonError(400, 'El cuerpo de la petición no es válido.');

  const clientIp = clientIpFrom(request.headers, env);
  const options = { env };

  let login: Response;
  try {
    login = await callBackend(
      '/auth/login',
      { method: 'POST', json: credentials, clientIp },
      options,
    );
  } catch (error) {
    if (error instanceof BackendError) return backendErrorResponse(error);
    throw error;
  }
  if (!login.ok) return relayBackendError(login);

  const payload: unknown = await login.json().catch(() => null);
  if (!isLoginPayload(payload))
    return jsonError(502, 'Respuesta inesperada del servidor.');

  const { accessToken, expiresIn } = payload;
  const session = await fetchSession(accessToken, null, { env, clientIp });
  if (session.status !== 'ok') {
    // No se pudo conocer el rol: se revoca la sesión recién creada para no dejarla huérfana.
    await callBackend(
      '/auth/logout',
      { method: 'POST', token: accessToken, clientIp },
      options,
    ).catch(() => undefined);
    return jsonError(
      502,
      'No pudimos completar el inicio de sesión. Inténtalo de nuevo.',
    );
  }

  const {
    session: sessionCookie,
    exp,
    expiresAt,
  } = buildSessionCookies({ token: accessToken, expiresIn }, env.COOKIE_SECURE);
  const headers = new Headers();
  headers.append('Set-Cookie', serializeCookie(sessionCookie));
  headers.append('Set-Cookie', serializeCookie(exp));
  return jsonResponse({ user: session.user, expiresAt }, { headers });
}
