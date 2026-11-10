/** Mensajes en es-CO para los errores que el usuario puede provocar o sufrir. */
export const MESSAGES = {
  tooManyRequests:
    'Demasiados intentos, espera un momento e inténtalo de nuevo.',
  unreachable: 'No pudimos conectar con el servidor.',
  generic: 'Ocurrió un error inesperado. Inténtalo de nuevo.',
} as const;

/** Error de la API (del back o del BFF), ya normalizado. */
export class ApiError extends Error {
  readonly status: number;
  /** Siempre una lista: el back envía `message` como texto o como arreglo. */
  readonly messages: string[];
  readonly error: string | undefined;

  constructor(status: number, messages: string[], error?: string) {
    super(messages[0] ?? MESSAGES.generic);
    this.name = 'ApiError';
    this.status = status;
    this.messages = messages.length > 0 ? messages : [MESSAGES.generic];
    this.error = error;
  }

  /** Sin respuesta (red caída, servidor apagado): lo trata la UI como 502. */
  get isUnreachable(): boolean {
    return this.status === 0 || this.status === 502 || this.status === 504;
  }
}

export function isApiError(value: unknown): value is ApiError {
  return value instanceof ApiError;
}

function toMessages(value: unknown): string[] {
  if (typeof value === 'string') return value.trim() ? [value] : [];
  if (Array.isArray(value)) {
    return value.filter(
      (item): item is string => typeof item === 'string' && item.trim() !== '',
    );
  }
  return [];
}

/** Convierte una respuesta de error (cuerpo ya leído) en `ApiError`. Tolera cuerpos que no son JSON. */
export function parseApiError(status: number, body: unknown): ApiError {
  if (typeof body === 'object' && body !== null) {
    const { message, error } = body as { message?: unknown; error?: unknown };
    const messages = toMessages(message);
    if (messages.length > 0) {
      return new ApiError(
        status,
        messages,
        typeof error === 'string' ? error : undefined,
      );
    }
  }
  return new ApiError(status, [defaultMessage(status)]);
}

export function networkError(): ApiError {
  return new ApiError(0, [MESSAGES.unreachable]);
}

function defaultMessage(status: number): string {
  if (status === 429) return MESSAGES.tooManyRequests;
  if (status === 502 || status === 504 || status === 0)
    return MESSAGES.unreachable;
  return MESSAGES.generic;
}

/**
 * Lista de mensajes para mostrar al usuario. El 429 y los fallos de conexión usan
 * textos fijos, aunque el cuerpo traiga otra cosa (por ejemplo, HTML del proxy).
 */
export function describeApiError(error: unknown): string[] {
  if (!isApiError(error)) return [MESSAGES.generic];
  if (error.status === 429) return [MESSAGES.tooManyRequests];
  if (error.isUnreachable) return [MESSAGES.unreachable];
  return error.messages;
}
