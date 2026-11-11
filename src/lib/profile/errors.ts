import { describeApiError, isApiError } from '@/lib/api/errors';

export const AMBIGUOUS_PROFILE =
  'No pudimos confirmar el cambio: revisamos tu perfil y no aparece. Tus datos siguen aquí; puedes intentar de nuevo.';
export const AMBIGUOUS_PASSWORD =
  'No pudimos confirmar si se cambió tu contraseña. Si la actual ya no te sirve, prueba con la nueva; si no, inténtalo de nuevo.';
export const WRONG_CURRENT = 'La contraseña actual no es correcta.';

export interface ProfileError {
  kind: 'validation' | 'missing' | 'ambiguous' | 'other';
  /** Mensajes del back que pertenecen a un campo. */
  fields: { fullName?: string; phone?: string };
  /** El resto, para el aviso del formulario. */
  messages: string[];
}

/** Errores de `PATCH /customers/me`: los 400 se reparten por campo según el texto del back. */
export function describeProfileError(error: unknown): ProfileError {
  const none: ProfileError['fields'] = {};
  if (!isApiError(error))
    return { kind: 'other', fields: none, messages: describeApiError(error) };
  if (error.isUnreachable || error.status >= 500)
    return { kind: 'ambiguous', fields: none, messages: [AMBIGUOUS_PROFILE] };
  if (error.status === 404)
    return {
      kind: 'missing',
      fields: none,
      messages: ['No encontramos tu perfil. Cierra sesión e ingresa de nuevo.'],
    };
  if (error.status === 400) {
    const fields: ProfileError['fields'] = {};
    const rest: string[] = [];
    for (const message of error.messages) {
      if (/^phone\b|celular|tel[eé]fono/i.test(message))
        fields.phone ??= message;
      else if (/^fullName\b/i.test(message)) fields.fullName ??= message;
      else rest.push(message);
    }
    return { kind: 'validation', fields, messages: rest };
  }
  return { kind: 'other', fields: none, messages: describeApiError(error) };
}

export interface PasswordError {
  kind: 'current' | 'same' | 'validation' | 'ambiguous' | 'other';
  messages: string[];
}

/**
 * Errores de `PATCH /auth/password`. El 403 es «contraseña actual incorrecta» (o cuenta bloqueada:
 * el back da el mismo texto), no falta de permiso.
 */
export function describePasswordError(error: unknown): PasswordError {
  if (!isApiError(error))
    return { kind: 'other', messages: describeApiError(error) };
  if (error.isUnreachable || error.status >= 500)
    return { kind: 'ambiguous', messages: [AMBIGUOUS_PASSWORD] };
  if (error.status === 403)
    return { kind: 'current', messages: [WRONG_CURRENT] };
  if (error.status === 400) {
    if (/distinta/i.test(error.messages.join(' ')))
      return {
        kind: 'same',
        messages: ['La contraseña nueva debe ser distinta de la actual.'],
      };
    return { kind: 'validation', messages: error.messages };
  }
  return { kind: 'other', messages: describeApiError(error) };
}
