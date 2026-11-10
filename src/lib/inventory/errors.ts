import { describeApiError, isApiError } from '@/lib/api/errors';

export type InventoryErrorKind =
  'missing' | 'conflict' | 'validation' | 'ambiguous' | 'network' | 'other';

export interface InventoryError {
  kind: InventoryErrorKind;
  messages: string[];
}

export const AMBIGUOUS =
  'No sabemos si se registró: revisa el historial antes de volver a intentarlo.';

/**
 * Traduce un error de inventario a lo que la pantalla muestra (D-068). En un movimiento
 * (`writes`) un corte de red o un 5xx es ambiguo: pudo registrarse, así que no se reintenta solo.
 */
export function describeInventoryError(
  error: unknown,
  options: { writes?: boolean } = {},
): InventoryError {
  if (!isApiError(error))
    return { kind: 'other', messages: describeApiError(error) };
  if (error.status === 404)
    return { kind: 'missing', messages: ['Este producto ya no existe.'] };
  if (error.status === 409)
    return { kind: 'conflict', messages: error.messages };
  if (error.status === 400)
    return { kind: 'validation', messages: error.messages };
  if (error.isUnreachable || error.status >= 500) {
    return options.writes
      ? { kind: 'ambiguous', messages: [AMBIGUOUS] }
      : { kind: 'network', messages: describeApiError(error) };
  }
  return { kind: 'other', messages: describeApiError(error) };
}
