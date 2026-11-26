import { describeApiError, isApiError } from '@/lib/api/errors';

export type OrderErrorKind =
  'card' | 'conflict' | 'validation' | 'rate' | 'network' | 'other';

export interface OrderError {
  kind: OrderErrorKind;
  messages: string[];
}

/** Traduce el error de `POST /orders` a lo que la pantalla debe hacer (D-041). */
export function describeOrderError(error: unknown): OrderError {
  if (!isApiError(error))
    return { kind: 'other', messages: describeApiError(error) };
  switch (true) {
    case error.status === 402:
      return { kind: 'card', messages: ['La tarjeta fue rechazada.'] };
    case error.status === 404 || error.status === 409:
      return { kind: 'conflict', messages: error.messages };
    case error.status === 400:
      return { kind: 'validation', messages: error.messages };
    case error.status === 429:
      return { kind: 'rate', messages: describeApiError(error) };
    case error.isUnreachable:
      return { kind: 'network', messages: describeApiError(error) };
    default:
      return { kind: 'other', messages: describeApiError(error) };
  }
}
