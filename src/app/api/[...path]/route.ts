import { getEnv } from '@/lib/server/env';
import { jsonError } from '@/lib/server/errors';
import { forward } from '@/lib/server/forward';
import { checkRequest, requestCarriesBody } from '@/lib/server/origin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Pasarela hacia el back. Los métodos que modifican datos pasan primero por la
 * defensa CSRF (D-017); después `forward` aplica la tabla de rutas y el token de la cookie.
 */
async function handle(request: Request): Promise<Response> {
  const env = getEnv();
  const guard = checkRequest(
    request.method,
    request.headers,
    env.ALLOWED_ORIGINS,
    await requestCarriesBody(request),
  );
  if (!guard.ok) return jsonError(guard.status, guard.message);
  return forward(request, { env });
}

export {
  handle as GET,
  handle as POST,
  handle as PUT,
  handle as PATCH,
  handle as DELETE,
};
