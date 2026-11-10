import 'server-only';
import { parseApiError } from '@/lib/api/errors';
import type { AppEnv } from './env';
import { errorBody, jsonError } from './errors';

export const BACKEND_TIMEOUT_MS = 15_000;

/** El back no respondió: 504 si se agotó el tiempo, 502 en cualquier otro fallo. */
export class BackendError extends Error {
  readonly status: 502 | 504;

  constructor(status: 502 | 504) {
    super(status === 504 ? 'Tiempo agotado' : 'Sin conexión');
    this.name = 'BackendError';
    this.status = status;
  }
}

export interface BackendOptions {
  env: Pick<AppEnv, 'API_URL'>;
  /** Para pruebas. */
  fetch?: typeof fetch;
  timeoutMs?: number;
}

export interface BackendInit {
  method?: string;
  /** Se envía como `Authorization: Bearer`. */
  token?: string | null;
  json?: unknown;
  /** IP real del cliente (ya calculada, D-023) para los límites por IP del back. */
  clientIp?: string | null;
}

/** Llamada del servidor al back. Nunca registra cuerpos ni cabeceras. */
export async function callBackend(
  path: string,
  init: BackendInit,
  options: BackendOptions,
): Promise<Response> {
  const headers = new Headers({ accept: 'application/json' });
  if (init.token) headers.set('authorization', `Bearer ${init.token}`);
  if (init.json !== undefined) headers.set('content-type', 'application/json');
  if (init.clientIp) headers.set('x-forwarded-for', init.clientIp);

  try {
    return await (options.fetch ?? fetch)(`${options.env.API_URL}${path}`, {
      method: init.method ?? 'GET',
      headers,
      body: init.json !== undefined ? JSON.stringify(init.json) : null,
      redirect: 'manual',
      signal: AbortSignal.timeout(options.timeoutMs ?? BACKEND_TIMEOUT_MS),
    });
  } catch (error) {
    throw new BackendError(
      error instanceof Error && error.name === 'TimeoutError' ? 504 : 502,
    );
  }
}

export function backendErrorResponse(error: BackendError): Response {
  return error.status === 504
    ? jsonError(504, 'El servidor tardó demasiado en responder.')
    : jsonError(502, 'No pudimos conectar con el servidor.');
}

/** Reenvía el estado y el mensaje de un error del back en el formato estándar. */
export async function relayBackendError(upstream: Response): Promise<Response> {
  let body: unknown = null;
  try {
    body = await upstream.json();
  } catch {
    // cuerpo vacío o que no es JSON
  }
  const { messages } = parseApiError(upstream.status, body);
  // Se conserva la forma original: el back usa un arreglo para los errores de validación.
  const wasList =
    typeof body === 'object' &&
    body !== null &&
    Array.isArray((body as { message?: unknown }).message);
  return jsonError(
    upstream.status,
    wasList || messages.length > 1 ? messages : messages[0]!,
  );
}

export { errorBody };
