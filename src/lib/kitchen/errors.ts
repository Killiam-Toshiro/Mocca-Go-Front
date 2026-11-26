import { describeApiError, isApiError } from '@/lib/api/errors';

export type KitchenErrorKind =
  'conflict' | 'missing' | 'validation' | 'network' | 'other';

export interface KitchenError {
  kind: KitchenErrorKind;
  messages: string[];
}

/** Traduce el error de una acción de cocina a lo que la pantalla debe mostrar (D-058, D-059). */
export function describeKitchenError(error: unknown): KitchenError {
  if (!isApiError(error))
    return { kind: 'other', messages: describeApiError(error) };
  switch (true) {
    case error.status === 409:
      return {
        kind: 'conflict',
        messages: ['Otro operador ya cambió este pedido.'],
      };
    case error.status === 404:
      return { kind: 'missing', messages: ['Este pedido ya no existe.'] };
    case error.status === 400:
      return { kind: 'validation', messages: error.messages };
    case error.isUnreachable:
      return { kind: 'network', messages: describeApiError(error) };
    default:
      return { kind: 'other', messages: describeApiError(error) };
  }
}
