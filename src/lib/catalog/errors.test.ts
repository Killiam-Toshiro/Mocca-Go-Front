import { describe, expect, it } from 'vitest';
import { ApiError } from '@/lib/api/errors';
import { describeCatalogError } from './errors';

const api = (status: number, message: string | string[]) =>
  new ApiError(status, Array.isArray(message) ? message : [message]);

describe('describeCatalogError', () => {
  it('reconoce el SKU repetido y lo ubica en su campo', () => {
    const e = describeCatalogError(api(409, 'El SKU ya existe.'));
    expect(e.kind).toBe('duplicate');
    expect(e.fields.sku).toBe('El SKU ya existe.');
  });
  it('los otros 409 y el 404 conservan el texto del back', () => {
    const c = describeCatalogError(
      api(409, 'El producto es componente de un combo.'),
    );
    expect(c).toMatchObject({
      kind: 'conflict',
      messages: ['El producto es componente de un combo.'],
    });
    expect(describeCatalogError(api(404, 'Producto no encontrado.')).kind).toBe(
      'missing',
    );
  });
  it('reparte los 400 por campo y deja el resto', () => {
    const e = describeCatalogError(
      api(400, [
        'sku must match /^[A-Z0-9]/ regular expression',
        'name must be longer than or equal to 1 characters',
        'price must be an integer',
        'cost must be an integer',
        'El componente CAF-1 está inactivo.',
        'Indica al menos un campo para editar.',
      ]),
    );
    expect(e.kind).toBe('validation');
    expect(e.fields.sku).toMatch(/^sku/);
    expect(e.fields.name).toMatch(/^name/);
    expect(e.fields.price).toMatch(/^price/);
    expect(e.fields.cost).toMatch(/^cost/);
    expect(e.fields.components).toBe('El componente CAF-1 está inactivo.');
    expect(e.messages).toEqual(['Indica al menos un campo para editar.']);
  });
  it('red o 5xx es ambiguo', () => {
    expect(describeCatalogError(new TypeError('x')).kind).toBe('other');
    expect(describeCatalogError(api(502, 'bad')).kind).toBe('ambiguous');
  });
});
