import { describeApiError, isApiError } from '@/lib/api/errors';

export type SurveyErrorKind =
  'already' | 'state' | 'missing' | 'validation' | 'ambiguous' | 'other';

export interface SurveyError {
  kind: SurveyErrorKind;
  messages: string[];
}

export const AMBIGUOUS_SURVEY =
  'No pudimos confirmar si se guardó tu calificación: revisamos el pedido y no aparece. Tu respuesta sigue aquí; puedes intentar de nuevo.';

/**
 * Traduce un error al enviar la encuesta según los textos fijos del back (`surveys.service.ts`,
 * plan 006 Anexo A). Los 409 se distinguen por su texto; si ninguno coincide se muestra el del back.
 */
export function describeSurveyError(error: unknown): SurveyError {
  if (!isApiError(error))
    return { kind: 'other', messages: describeApiError(error) };
  if (error.isUnreachable || error.status >= 500)
    return { kind: 'ambiguous', messages: [AMBIGUOUS_SURVEY] };
  if (error.status === 404)
    return {
      kind: 'missing',
      messages: ['No encontramos este pedido.'],
    };
  if (error.status === 400)
    return { kind: 'validation', messages: error.messages };
  if (error.status === 409) {
    const text = error.messages.join(' ');
    if (/ya tiene una respuesta/i.test(text))
      return {
        kind: 'already',
        messages: [
          'Este pedido ya tenía una calificación; te mostramos la guardada.',
        ],
      };
    if (/está en estado/i.test(text))
      return {
        kind: 'state',
        messages: [
          'Este pedido ya no se puede calificar todavía: solo se califica cuando está entregado.',
        ],
      };
    return { kind: 'state', messages: error.messages };
  }
  return { kind: 'other', messages: describeApiError(error) };
}
