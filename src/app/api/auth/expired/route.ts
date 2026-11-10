import { sanitizeReturnPath } from '@/lib/auth/safe-next';
import { clearSessionCookies, serializeCookie } from '@/lib/server/cookies';
import { getEnv } from '@/lib/server/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Único GET con efecto: solo borra las cookies de sesión y lleva a `/login?expired=1`.
 * Lo usan los layouts cuando el back dice que la sesión murió; al borrar las cookies
 * antes de llegar a `/login` no puede haber bucle. No expone ni modifica datos.
 */
export function GET(request: Request): Response {
  const env = getEnv();
  const next = sanitizeReturnPath(
    new URL(request.url).searchParams.get('next'),
  );
  const location = next
    ? `/login?expired=1&next=${encodeURIComponent(next)}`
    : '/login?expired=1';

  const headers = new Headers({
    Location: location,
    'Cache-Control': 'no-store',
  });
  for (const cookie of clearSessionCookies(env.COOKIE_SECURE)) {
    headers.append('Set-Cookie', serializeCookie(cookie));
  }
  return new Response(null, { status: 303, headers });
}
