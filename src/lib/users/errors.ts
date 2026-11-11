import { describeApiError, isApiError } from '@/lib/api/errors';

export const AMBIGUOUS_USER =
  'No pudimos confirmar si el cambio se aplicó. Revisamos la lista y no lo encontramos; puedes intentar de nuevo.';
export const AMBIGUOUS_PASSWORD_RESET =
  'No pudimos confirmar si se restableció la contraseña. Inténtalo de nuevo; si ya se había cambiado, la nueva clave seguirá funcionando.';

export interface UserError {
  kind:
    'duplicate' | 'validation' | 'missing' | 'conflict' | 'ambiguous' | 'other';
  /** Mensajes del back que pertenecen a un campo. */
  fields: {
    username?: string;
    fullName?: string;
    phone?: string;
    password?: string;
  };
  /** El resto, para el aviso del panel (siempre el texto del back). */
  messages: string[];
}

/**
 * Errores de las operaciones de `users`. El texto del back es la autoridad: no se compara para decidir
 * qué mostrar salvo para ubicar un 400 en su campo o reconocer «el username ya existe».
 */
export function describeUserError(
  error: unknown,
  ambiguousMessage: string = AMBIGUOUS_USER,
): UserError {
  const none: UserError['fields'] = {};
  if (!isApiError(error))
    return { kind: 'other', fields: none, messages: describeApiError(error) };
  if (error.isUnreachable || error.status >= 500)
    return { kind: 'ambiguous', fields: none, messages: [ambiguousMessage] };
  if (error.status === 404)
    return { kind: 'missing', fields: none, messages: error.messages };
  if (error.status === 409) {
    if (/username ya existe/i.test(error.messages.join(' ')))
      return {
        kind: 'duplicate',
        fields: { username: error.messages[0] },
        messages: [],
      };
    return { kind: 'conflict', fields: none, messages: error.messages };
  }
  if (error.status === 400) {
    const fields: UserError['fields'] = {};
    const rest: string[] = [];
    for (const message of error.messages) {
      if (/repartidor necesita/i.test(message)) rest.push(message);
      else if (/^username\b|username/i.test(message))
        fields.username ??= message;
      else if (/^fullName\b|nombre/i.test(message)) fields.fullName ??= message;
      else if (/^phone\b|celular|tel[eé]fono/i.test(message))
        fields.phone ??= message;
      else if (/^password\b|contraseña/i.test(message))
        fields.password ??= message;
      else rest.push(message);
    }
    return { kind: 'validation', fields, messages: rest };
  }
  return { kind: 'other', fields: none, messages: describeApiError(error) };
}
