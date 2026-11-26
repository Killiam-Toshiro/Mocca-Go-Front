import { describeApiError, isApiError } from '@/lib/api/errors';

export type DispatchErrorKind =
  | 'profile'
  | 'rounds-limit'
  | 'no-ready'
  | 'taken'
  | 'zones'
  | 'conflict'
  | 'missing'
  | 'validation'
  | 'ambiguous'
  | 'network'
  | 'other';

export interface DispatchError {
  kind: DispatchErrorKind;
  messages: string[];
}

export const AMBIGUOUS_ROUND =
  'No sabemos si la ronda salió: se revisó «Mis rondas» antes de dejarte intentar de nuevo.';
export const AMBIGUOUS_CLOSE =
  'No sabemos si el cambio quedó registrado: se revisó la ronda antes de dejarte intentar de nuevo.';

const TEXT = {
  profile:
    'Falta tu nombre o teléfono en el perfil: pídele al administrador que los complete.',
  limit: 'Ya tienes 2 rondas activas: termina una para salir de nuevo.',
  noReady:
    'Otro repartidor acaba de tomar esos pedidos o ya no están listos; se actualizó la cola.',
  taken: (numbers: string) =>
    `Los pedidos ${numbers} ya no están listos (otro repartidor los tomó o cambiaron); se actualizó la cola.`,
  zones: 'Una ronda es de una sola zona; elige pedidos de una sola zona.',
};

/**
 * Traduce un error al crear la ronda. El back tiene textos fijos para cada 409 (`dispatch.service.ts`,
 * plan 005 Anexo A); si ninguno coincide se muestra el mensaje del back tal cual.
 */
export function describeCreateRoundError(error: unknown): DispatchError {
  if (!isApiError(error))
    return { kind: 'other', messages: describeApiError(error) };
  if (error.isUnreachable || error.status >= 500)
    return { kind: 'ambiguous', messages: [AMBIGUOUS_ROUND] };
  if (error.status === 404)
    return {
      kind: 'missing',
      messages: [
        'Alguno de los pedidos elegidos ya no existe; se actualizó la cola.',
      ],
    };
  if (error.status === 400)
    return { kind: 'validation', messages: error.messages };
  if (error.status === 409) {
    const text = error.messages.join(' ');
    if (/perfil de repartidor/i.test(text))
      return { kind: 'profile', messages: [TEXT.profile] };
    if (/rondas activas/i.test(text))
      return { kind: 'rounds-limit', messages: [TEXT.limit] };
    if (/No hay pedidos listos/i.test(text))
      return { kind: 'no-ready', messages: [TEXT.noReady] };
    const taken = /Los pedidos (.+?) ya no están en estado/i.exec(text);
    if (taken) return { kind: 'taken', messages: [TEXT.taken(taken[1] ?? '')] };
    if (/una sola zona/i.test(text))
      return { kind: 'zones', messages: [TEXT.zones] };
    return { kind: 'conflict', messages: error.messages };
  }
  return { kind: 'other', messages: describeApiError(error) };
}

/** Traduce un error al entregar o marcar «no entregado» un pedido. */
export function describeCloseError(error: unknown): DispatchError {
  if (!isApiError(error))
    return { kind: 'other', messages: describeApiError(error) };
  if (error.status === 404)
    return {
      kind: 'missing',
      messages: [
        'Este pedido ya no está en tus rondas; se actualizó la lista.',
      ],
    };
  if (error.status === 409)
    return {
      kind: 'conflict',
      messages: [
        'Este pedido ya no está en camino (alguien lo cerró o cambió); se actualizó la ronda.',
      ],
    };
  if (error.status === 400)
    return { kind: 'validation', messages: error.messages };
  if (error.isUnreachable || error.status >= 500)
    return { kind: 'ambiguous', messages: [AMBIGUOUS_CLOSE] };
  return { kind: 'other', messages: describeApiError(error) };
}
