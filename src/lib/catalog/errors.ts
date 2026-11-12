import { describeApiError, isApiError } from '@/lib/api/errors';

export const AMBIGUOUS_CATALOG =
  'No pudimos confirmar si el cambio se aplicó. Revisamos el catálogo y no lo encontramos; puedes intentar de nuevo.';

export interface CatalogError {
  kind:
    'duplicate' | 'validation' | 'missing' | 'conflict' | 'ambiguous' | 'other';
  fields: {
    sku?: string;
    name?: string;
    description?: string;
    price?: string;
    cost?: string;
    components?: string;
    category?: string;
  };
  /** El resto, siempre con el texto del back. */
  messages: string[];
}

/**
 * Errores de `products`. El texto del back manda: solo se usa para ubicar un 400 en su campo o
 * reconocer «El SKU ya existe.».
 */
export function describeCatalogError(
  error: unknown,
  ambiguous: string = AMBIGUOUS_CATALOG,
): CatalogError {
  const none: CatalogError['fields'] = {};
  if (!isApiError(error))
    return { kind: 'other', fields: none, messages: describeApiError(error) };
  if (error.isUnreachable || error.status >= 500)
    return { kind: 'ambiguous', fields: none, messages: [ambiguous] };
  if (error.status === 404)
    return { kind: 'missing', fields: none, messages: error.messages };
  if (error.status === 409) {
    if (/sku ya existe/i.test(error.messages.join(' ')))
      return {
        kind: 'duplicate',
        fields: { sku: error.messages[0] },
        messages: [],
      };
    return { kind: 'conflict', fields: none, messages: error.messages };
  }
  if (error.status === 400) {
    const fields: CatalogError['fields'] = {};
    const rest: string[] = [];
    for (const m of error.messages) {
      if (/^sku\b/i.test(m)) fields.sku ??= m;
      else if (/^name\b/i.test(m)) fields.name ??= m;
      else if (/^description\b/i.test(m)) fields.description ??= m;
      else if (/^price\b|precio/i.test(m)) fields.price ??= m;
      else if (/^cost\b|costo/i.test(m)) fields.cost ??= m;
      else if (/^category\b/i.test(m)) fields.category ??= m;
      else if (/^components\b|componente|composici[oó]n|combo/i.test(m))
        fields.components ??= m;
      else rest.push(m);
    }
    return { kind: 'validation', fields, messages: rest };
  }
  return { kind: 'other', fields: none, messages: describeApiError(error) };
}
