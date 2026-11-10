import createClient, { type Middleware } from 'openapi-fetch';
import { networkError, parseApiError } from './errors';
import type { paths } from './schema';

export interface ApiClientOptions {
  baseUrl?: string;
  fetch?: typeof fetch;
  /** Se invoca cuando el servidor responde 401: la sesión terminó. */
  onUnauthorized?: () => void;
}

/**
 * Cliente tipado del contrato. El navegador solo habla con el mismo origen:
 * `/api/...` lo atiende Next (BFF) y reenvía al back con el token de la cookie.
 * Las rutas del cliente van sin `/api/v1`; el prefijo lo pone la pasarela.
 */
export function createApiClient(options: ApiClientOptions = {}) {
  const client = createClient<paths>({
    baseUrl: options.baseUrl ?? '/api',
    ...(options.fetch ? { fetch: options.fetch } : {}),
  });
  const { onUnauthorized } = options;
  if (onUnauthorized) {
    const middleware: Middleware = {
      onResponse({ response }) {
        if (response.status === 401) onUnauthorized();
        return undefined;
      },
    };
    client.use(middleware);
  }
  return client;
}

interface Result<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

/** Convierte el resultado de `openapi-fetch` en el dato, o lanza `ApiError`. */
export async function unwrap<T>(request: Promise<Result<T>>): Promise<T> {
  let result: Result<T>;
  try {
    result = await request;
  } catch {
    throw networkError();
  }
  if (!result.response.ok)
    throw parseApiError(result.response.status, result.error);
  return result.data as T;
}
