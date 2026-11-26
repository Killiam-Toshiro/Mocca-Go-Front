import 'server-only';

const REASONS: Record<number, string> = {
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  415: 'Unsupported Media Type',
  429: 'Too Many Requests',
  502: 'Bad Gateway',
  504: 'Gateway Timeout',
};

export interface ErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
}

/** Mismo formato de error que el back, para que el cliente maneje un solo caso. */
export function errorBody(
  statusCode: number,
  message: string | string[],
): ErrorBody {
  return { statusCode, message, error: REASONS[statusCode] ?? 'Error' };
}

export function jsonError(
  statusCode: number,
  message: string | string[],
  headers?: HeadersInit,
): Response {
  const responseHeaders = new Headers(headers);
  responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
  responseHeaders.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(errorBody(statusCode, message)), {
    status: statusCode,
    headers: responseHeaders,
  });
}

/** Respuesta JSON privada (sin caché). */
export function jsonResponse(
  body: unknown,
  init: { status?: number; headers?: Headers } = {},
): Response {
  const headers = init.headers ?? new Headers();
  headers.set('Content-Type', 'application/json; charset=utf-8');
  headers.set('Cache-Control', 'no-store');
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers,
  });
}
