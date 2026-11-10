import { describe, expect, it } from 'vitest';
import {
  availability,
  matchesFilter,
  NO_FILTER,
  type ProductFilter,
} from './availability';
import { toStaffProduct } from './types';
import { backProduct } from '../../../tests/utils/inventory';

const staff = (o: Parameters<typeof backProduct>[0]) =>
  toStaffProduct(backProduct(o));

describe('availability', () => {
  it('cada combinación tiene su palabra', () => {
    expect(availability(staff({})).label).toBe('Disponible');
    expect(availability(staff({ soldOut: true, available: false })).label).toBe(
      'Agotado',
    );
    expect(availability(staff({ available: false, stock: 0 })).label).toBe(
      'Sin saldo',
    );
    expect(availability(staff({ active: false, available: false })).label).toBe(
      'Inactivo',
    );
    expect(
      availability(staff({ category: 'combo', available: false, stock: 0 }))
        .label,
    ).toBe('Falta saldo de un componente');
    expect(availability(staff({ available: false, stock: 5 })).label).toBe(
      'No disponible',
    );
  });
  it('inactivo gana sobre agotado, y agotado sobre disponible', () => {
    expect(availability(staff({ active: false, soldOut: true })).key).toBe(
      'inactivo',
    );
    expect(availability(staff({ soldOut: true, available: true })).key).toBe(
      'agotado',
    );
  });
});

describe('matchesFilter', () => {
  const capu = staff({ name: 'Té chai', sku: 'BEB-CHAI', category: 'bebida' });
  const f = (o: Partial<ProductFilter>): ProductFilter => ({
    ...NO_FILTER,
    ...o,
  });

  it('busca por nombre o SKU sin tildes ni mayúsculas', () => {
    expect(matchesFilter(capu, f({ search: 'te CHAI' }))).toBe(true);
    expect(matchesFilter(capu, f({ search: 'beb-' }))).toBe(true);
    expect(matchesFilter(capu, f({ search: 'latte' }))).toBe(false);
    expect(matchesFilter(capu, f({ search: '   ' }))).toBe(true);
  });
  it('filtra por categoría y por agotados o sin saldo', () => {
    expect(matchesFilter(capu, f({ category: 'cafe' }))).toBe(false);
    expect(matchesFilter(capu, f({ category: 'bebida' }))).toBe(true);
    expect(matchesFilter(capu, f({ status: 'agotados' }))).toBe(false);
    const out = staff({ soldOut: true, available: false });
    const none = staff({ available: false, stock: 0 });
    const off = staff({ active: false, available: false });
    expect(matchesFilter(out, f({ status: 'agotados' }))).toBe(true);
    expect(matchesFilter(none, f({ status: 'agotados' }))).toBe(true);
    expect(matchesFilter(off, f({ status: 'agotados' }))).toBe(false);
  });
});

describe('toStaffProduct', () => {
  it('descarta el costo y el margen', () => {
    const product = toStaffProduct(backProduct());
    expect(product).not.toHaveProperty('cost');
    expect(product).not.toHaveProperty('costPercent');
  });
});
