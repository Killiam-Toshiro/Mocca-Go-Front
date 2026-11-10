import { notifyUnauthorized } from './browser-client';
import { networkError, parseApiError } from './errors';

/**
 * `fetch` JSON al mismo origen (rutas propias de Next: login, logout, registro).
 * Lanza `ApiError`; el navegador envía solo las cookies del propio sitio.
 */
export async function requestJson<T = undefined>(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    /** Cabeceras extra permitidas por la pasarela (p. ej. `idempotency-key`). */
    headers?: Record<string, string>;
    /** Rutas privadas: un 401 cierra la sesión local (como el cliente tipado). */
    handleUnauthorized?: boolean;
  } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'POST',
      credentials: 'same-origin',
      headers: {
        accept: 'application/json',
        ...(options.body === undefined
          ? {}
          : { 'content-type': 'application/json' }),
        ...options.headers,
      },
      body: options.body === undefined ? null : JSON.stringify(options.body),
    });
  } catch {
    throw networkError();
  }

  if (!response.ok) {
    if (response.status === 401 && options.handleUnauthorized)
      notifyUnauthorized();
    throw parseApiError(
      response.status,
      await response.json().catch(() => null),
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json().catch(() => undefined)) as T;
}
