import { describeApiError, isApiError } from '@/lib/api/errors';

export const AMBIGUOUS_ZONES =
  'No pudimos confirmar si el cambio se aplicó. Revisamos las zonas y no lo encontramos; puedes intentar de nuevo.';

export interface ZoneError {
  kind:
    | 'duplicate'
    | 'history'
    | 'validation'
    | 'missing'
    | 'conflict'
    | 'ambiguous'
    | 'other';
  fields: { name?: string; hint?: string; floors?: string; zoneId?: string };
  /** El resto, siempre con el texto del back. */
  messages: string[];
}

/**
 * Errores de `delivery-zones` y `delivery-points`. El texto del back manda: solo se usa para ubicar
 * un 400 en su campo y para distinguir un nombre repetido (409) de «tiene pedidos/rondas» (409 por
 * historial: la salida es desactivar).
 */
export function describeZoneError(
  error: unknown,
  ambiguous: string = AMBIGUOUS_ZONES,
): ZoneError {
  const none: ZoneError['fields'] = {};
  if (!isApiError(error))
    return { kind: 'other', fields: none, messages: describeApiError(error) };
  if (error.isUnreachable || error.status >= 500)
    return { kind: 'ambiguous', fields: none, messages: [ambiguous] };
  if (error.status === 404)
    return { kind: 'missing', fields: none, messages: error.messages };
  if (error.status === 409) {
    const text = error.messages.join(' ');
    if (/ya existe/i.test(text))
      return {
        kind: 'duplicate',
        fields: { name: error.messages[0] },
        messages: [],
      };
    if (/tiene pedidos|rondas de despacho/i.test(text))
      return { kind: 'history', fields: none, messages: error.messages };
    return { kind: 'conflict', fields: none, messages: error.messages };
  }
  if (error.status === 400) {
    const fields: ZoneError['fields'] = {};
    const rest: string[] = [];
    for (const m of error.messages) {
      if (/^name\b/i.test(m)) fields.name ??= m;
      else if (/^hint\b/i.test(m)) fields.hint ??= m;
      else if (/^floors\b/i.test(m)) fields.floors ??= m;
      else if (/^zoneId\b/i.test(m)) fields.zoneId ??= m;
      else rest.push(m);
    }
    return { kind: 'validation', fields, messages: rest };
  }
  return { kind: 'other', fields: none, messages: describeApiError(error) };
}
