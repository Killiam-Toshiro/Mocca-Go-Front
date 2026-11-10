import { NextResponse, type NextRequest } from 'next/server';
import { getEnv } from '@/lib/server/env';
import { sessionCookieName } from '@/lib/server/cookies';
import {
  buildCsp,
  decideGuard,
  generateNonce,
  securityHeaders,
} from '@/lib/server/security';

/**
 * Proxy de Next (antes `middleware`): primera capa de guardas y cabeceras de seguridad.
 * Solo comprueba que exista la cookie de sesión; la validación real la hacen los layouts.
 */
export function proxy(request: NextRequest): NextResponse {
  const env = getEnv();
  const { pathname, search } = request.nextUrl;
  const isApi = pathname === '/api' || pathname.startsWith('/api/');
  const secure = securityHeaders({ secure: env.COOKIE_SECURE });

  if (!isApi) {
    const decision = decideGuard({
      pathname,
      search,
      hasSession: request.cookies.has(sessionCookieName(env.COOKIE_SECURE)),
    });
    if (decision.action === 'redirect') {
      // Next exige una URL absoluta aquí: se parte de la URL pública de la petición.
      const target = new URL(decision.to, 'http://destino.invalid');
      const url = request.nextUrl.clone();
      url.pathname = target.pathname;
      url.search = target.search;
      const response = NextResponse.redirect(url, 307);
      response.headers.set('Cache-Control', 'no-store');
      for (const [name, value] of Object.entries(secure))
        response.headers.set(name, value);
      return response;
    }
  }

  const requestHeaders = new Headers(request.headers);
  // Se sobrescriben siempre: un cliente no puede fijar la ruta ni el nonce.
  requestHeaders.set('x-next-path', `${pathname}${search}`);
  requestHeaders.delete('x-nonce');

  let csp: string | null = null;
  if (!isApi) {
    const nonce = generateNonce();
    csp = buildCsp(nonce, { dev: process.env.NODE_ENV !== 'production' });
    requestHeaders.set('x-nonce', nonce);
    requestHeaders.set('Content-Security-Policy', csp);
  }

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (csp) response.headers.set('Content-Security-Policy', csp);
  for (const [name, value] of Object.entries(secure))
    response.headers.set(name, value);
  return response;
}

export const config = {
  matcher: [
    // Todo menos los recursos estáticos y las precargas.
    {
      source: '/((?!_next/static|_next/image|favicon.ico).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
  ],
};
