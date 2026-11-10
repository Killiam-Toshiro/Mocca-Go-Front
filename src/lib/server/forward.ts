import 'server-only';
import { ROUTES, type RouteEntry } from '@/lib/api/routes.generated';
import type { AppEnv } from './env';
import { resolveClientIp } from './client-ip';
import {
  clearSessionCookies,
  readCookie,
  serializeCookie,
  sessionCookieName,
} from './cookies';
import { jsonError } from './errors';

/** Cabeceras del cliente que se reenvían al back. Todo lo demás se descarta. */
const FORWARDED_REQUEST_HEADERS = [
  'content-type',
  'accept',
  'idempotency-key',
] as const;
/** Cabeceras de la respuesta del back que se devuelven al navegador. */
const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  'retry-after',
  'etag',
  'last-modified',
  'content-disposition',
] as const;

const SEGMENT = /^[A-Za-z0-9._~-]+$/;
export const DEFAULT_TIMEOUT_MS = 30_000;

export type NormalizedPath = { ok: true; path: string } | { ok: false };

/**
 * Normaliza la ruta recibida (`/api/<ruta>`) y devuelve la del contrato (`/<ruta>`).
 * Se rechaza todo lo que no sea un segmento llano: `..`, `.`, segmentos vacíos
 * (`//`, barra final), codificación porcentual (`%2f`, `%2e`, `%5c`…) y `\`.
 */
export function normalizeApiPath(rawPath: string): NormalizedPath {
  if (!rawPath.startsWith('/api/')) return { ok: false };
  const segments = rawPath.slice('/api/'.length).split('/');
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..')
      return { ok: false };
    if (!SEGMENT.test(segment)) return { ok: false };
  }
  return { ok: true, path: `/${segments.join('/')}` };
}

interface CompiledRoute {
  entry: RouteEntry;
  segments: string[];
  params: number;
}

// Primero las rutas con menos parámetros: `/orders/stream` gana a `/orders/{id}`.
const COMPILED: CompiledRoute[] = ROUTES.filter((entry) => !entry.own)
  .map((entry) => {
    const segments = entry.pattern.split('/').slice(1);
    return {
      entry,
      segments,
      params: segments.filter((s) => s.startsWith('{')).length,
    };
  })
  .sort((a, b) => a.params - b.params);

/** Busca `método + ruta` en la tabla generada. `login` y `logout` quedan fuera (`own`). */
export function matchRoute(method: string, path: string): RouteEntry | null {
  const parts = path.split('/').slice(1);
  const verb = method.toUpperCase();
  for (const route of COMPILED) {
    if (route.entry.method !== verb || route.segments.length !== parts.length)
      continue;
    const matches = route.segments.every(
      (segment, i) => segment.startsWith('{') || segment === parts[i],
    );
    if (matches) return route.entry;
  }
  return null;
}

export interface ForwardOptions {
  env: Pick<AppEnv, 'API_URL' | 'TRUST_PROXY_HOPS' | 'COOKIE_SECURE'>;
  /** Para pruebas. */
  fetch?: typeof fetch;
  /** Tiempo máximo hasta recibir las cabeceras del back. */
  timeoutMs?: number;
}

/**
 * Pasarela hacia el back (D-016): reenvía solo lo que está en la tabla generada,
 * con el token tomado de la cookie, y devuelve el cuerpo como flujo.
 */
export async function forward(
  request: Request,
  options: ForwardOptions,
): Promise<Response> {
  const { env } = options;
  const url = new URL(request.url);

  const normalized = normalizeApiPath(url.pathname);
  if (!normalized.ok) return jsonError(400, 'Ruta no válida.');

  const route = matchRoute(request.method, normalized.path);
  if (!route) return jsonError(404, 'Ruta no encontrada.');

  const token = readCookie(
    request.headers.get('cookie'),
    sessionCookieName(env.COOKIE_SECURE),
  );
  if (!route.public && !token) {
    return jsonError(401, 'Sesión no iniciada o vencida.');
  }

  const headers = new Headers();
  for (const name of FORWARDED_REQUEST_HEADERS) {
    const value = request.headers.get(name);
    if (value) headers.set(name, value);
  }
  if (!route.public && token) headers.set('authorization', `Bearer ${token}`);
  const clientIp = resolveClientIp(
    request.headers.get('x-forwarded-for'),
    env.TRUST_PROXY_HOPS,
  );
  if (clientIp) headers.set('x-forwarded-for', clientIp);

  const hasBody =
    request.method !== 'GET' &&
    request.method !== 'HEAD' &&
    request.body !== null;

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  // Si el navegador se desconecta (p. ej. cierra un flujo SSE), se corta también la llamada al back.
  const abortWithClient = () => controller.abort();
  request.signal.addEventListener('abort', abortWithClient, { once: true });

  let upstream: Response;
  try {
    upstream = await (options.fetch ?? fetch)(
      `${env.API_URL}${normalized.path}${url.search}`,
      {
        method: request.method,
        headers,
        body: hasBody ? request.body : null,
        duplex: 'half',
        redirect: 'manual',
        signal: controller.signal,
      } as RequestInit,
    );
  } catch {
    clearTimeout(timer);
    request.signal.removeEventListener('abort', abortWithClient);
    return timedOut
      ? jsonError(504, 'El servidor tardó demasiado en responder.')
      : jsonError(502, 'No pudimos conectar con el servidor.');
  }
  clearTimeout(timer);

  // El back no redirige; una redirección sería una respuesta inesperada, no algo que seguir.
  if (upstream.status >= 300 && upstream.status < 400) {
    await upstream.body?.cancel();
    return jsonError(502, 'Respuesta inesperada del servidor.');
  }

  const responseHeaders = new Headers();
  for (const name of FORWARDED_RESPONSE_HEADERS) {
    const value = upstream.headers.get(name);
    if (value) responseHeaders.set(name, value);
  }
  if (route.public) {
    const cacheControl = upstream.headers.get('cache-control');
    if (cacheControl) responseHeaders.set('cache-control', cacheControl);
  } else {
    responseHeaders.set('cache-control', 'no-store');
  }
  if (route.stream) responseHeaders.set('x-accel-buffering', 'no');

  // Un 401 del back en una ruta privada significa sesión muerta: se borran las cookies.
  if (upstream.status === 401 && !route.public) {
    for (const cookie of clearSessionCookies(env.COOKIE_SECURE)) {
      responseHeaders.append('set-cookie', serializeCookie(cookie));
    }
  }

  const noBody =
    upstream.status === 204 ||
    upstream.status === 205 ||
    upstream.status === 304;
  return new Response(noBody ? null : upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
