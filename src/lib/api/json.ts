import { networkError, parseApiError } from './errors';

/**
 * `fetch` JSON al mismo origen (rutas propias de Next: login, logout, registro).
 * Lanza `ApiError`; el navegador envía solo las cookies del propio sitio.
 */
export async function requestJson<T = undefined>(
  url: string,
  options: { method?: string; body?: unknown } = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'POST',
      credentials: 'same-origin',
      headers:
        options.body === undefined
          ? { accept: 'application/json' }
          : { accept: 'application/json', 'content-type': 'application/json' },
      body: options.body === undefined ? null : JSON.stringify(options.body),
    });
  } catch {
    throw networkError();
  }

  if (!response.ok) {
    throw parseApiError(
      response.status,
      await response.json().catch(() => null),
    );
  }
  if (response.status === 204) return undefined as T;
  return (await response.json().catch(() => undefined)) as T;
}
