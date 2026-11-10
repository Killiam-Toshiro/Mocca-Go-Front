import 'server-only';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export type GuardResult =
  { ok: true } | { ok: false; status: 403 | 415; message: string };

export function isSafeMethod(method: string): boolean {
  return SAFE_METHODS.has(method.toUpperCase());
}

/** Host público: el primero de `X-Forwarded-Host` (lo fija el proxy de Railway) o `Host`. */
function requestHost(headers: Headers): string | null {
  const forwarded = headers.get('x-forwarded-host')?.split(',')[0]?.trim();
  const host = forwarded || headers.get('host')?.trim();
  return host ? host.toLowerCase() : null;
}

/**
 * Defensa CSRF (D-017). En métodos que modifican datos el `Origin` es obligatorio
 * y su host debe ser el del propio servidor, o un origen exacto de `ALLOWED_ORIGINS`.
 */
export function checkOrigin(
  method: string,
  headers: Headers,
  allowedOrigins: readonly string[] = [],
): GuardResult {
  if (isSafeMethod(method)) return { ok: true };

  const forbidden = {
    ok: false,
    status: 403,
    message: 'Origen de la petición no permitido.',
  } as const;
  const origin = headers.get('origin');
  if (!origin || origin === 'null') return forbidden;

  let parsed: URL;
  try {
    parsed = new URL(origin);
  } catch {
    return forbidden;
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:')
    return forbidden;
  if (allowedOrigins.includes(parsed.origin)) return { ok: true };

  const host = requestHost(headers);
  return host !== null && parsed.host.toLowerCase() === host
    ? { ok: true }
    : forbidden;
}

/** ¿Trae cuerpo la petición? (por sus cabeceras, sin leerlo). */
export function requestHasBody(headers: Headers): boolean {
  if (headers.has('transfer-encoding')) return true;
  const length = headers.get('content-length');
  return length !== null && length.trim() !== '' && length.trim() !== '0';
}

/**
 * ¿Trae cuerpo de verdad? Next entrega `request.body` no nulo incluso en un POST vacío,
 * así que no basta con mirarlo: se miran las cabeceras y, si no dicen nada, se espía el
 * primer fragmento de una copia (sin leer el resto ni consumir el cuerpo original).
 */
export async function requestCarriesBody(request: Request): Promise<boolean> {
  if (requestHasBody(request.headers)) return true;
  if (request.body === null) return false;
  const reader = request.clone().body?.getReader();
  if (!reader) return false;
  try {
    const { done, value } = await reader.read();
    return !done && (value?.byteLength ?? 0) > 0;
  } finally {
    // Sin `await`: en una copia (tee) la promesa solo se resuelve al cancelar también el original.
    reader.cancel().catch(() => undefined);
  }
}

/** Con cuerpo (por cabeceras o porque el llamador ya sabe que lo hay), solo `application/json`: los formularios clásicos no pueden enviarlo entre sitios. */
export function checkContentType(
  headers: Headers,
  hasBody = false,
): GuardResult {
  if (!hasBody && !requestHasBody(headers)) return { ok: true };
  const type = headers.get('content-type')?.split(';')[0]?.trim().toLowerCase();
  return type === 'application/json'
    ? { ok: true }
    : {
        ok: false,
        status: 415,
        message: 'El contenido debe enviarse como application/json.',
      };
}

/** Origen y tipo de contenido en una sola comprobación. */
export function checkRequest(
  method: string,
  headers: Headers,
  allowedOrigins: readonly string[] = [],
  hasBody = false,
): GuardResult {
  if (isSafeMethod(method)) return { ok: true };
  const origin = checkOrigin(method, headers, allowedOrigins);
  return origin.ok ? checkContentType(headers, hasBody) : origin;
}
