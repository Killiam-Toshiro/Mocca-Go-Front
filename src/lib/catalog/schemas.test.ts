import { describe, expect, it } from 'vitest';
import { backProduct } from '../../../tests/utils/inventory';
import {
  changedFields,
  comboTotals,
  createBody,
  editSchema,
  editValuesOf,
  formatCostPercent,
  hasChanges,
  parseMoney,
  productSchema,
  type ComponentPick,
  type ProductFormValues,
} from './schemas';

const pick = (over: Partial<ComponentPick> = {}): ComponentPick => ({
  productId: 'p1',
  sku: 'A',
  name: 'A',
  quantity: 1,
  price: 3000,
  cost: 1000,
  ...over,
});

const simple: ProductFormValues = {
  kind: 'producto',
  sku: 'CAF-1',
  name: 'Café',
  description: '',
  category: 'cafe',
  price: '4500',
  cost: '1600',
  components: [],
};
const combo: ProductFormValues = {
  ...simple,
  kind: 'combo',
  sku: 'CMB-1',
  price: '',
  cost: '',
  components: [
    pick(),
    pick({ productId: 'p2', sku: 'B', quantity: 2, price: 2000, cost: 500 }),
  ],
};
const issues = (v: ProductFormValues) => {
  const r = productSchema.safeParse(v);
  return r.success ? [] : r.error.issues.map((i) => String(i.path[0]));
};

describe('parseMoney', () => {
  it('acepta solo enteros con dígitos', () => {
    expect(parseMoney(' 4500 ')).toBe(4500);
    expect(parseMoney('0')).toBe(0);
    for (const bad of ['', '4.500', '-1', '1,5', 'abc', '1234567890'])
      expect(parseMoney(bad)).toBeNull();
  });
});

describe('productSchema', () => {
  it('acepta un simple y un combo válidos (precio del combo opcional)', () => {
    expect(issues(simple)).toEqual([]);
    expect(issues(combo)).toEqual([]);
    expect(issues({ ...combo, price: '7000' })).toEqual([]);
  });
  it('valida SKU, nombre, descripción, precio y costo', () => {
    expect(issues({ ...simple, sku: 'caf-1' })).toContain('sku');
    expect(issues({ ...simple, sku: '' })).toContain('sku');
    expect(issues({ ...simple, name: '  ' })).toContain('name');
    expect(issues({ ...simple, name: 'x'.repeat(121) })).toContain('name');
    expect(issues({ ...simple, description: 'x'.repeat(501) })).toContain(
      'description',
    );
    expect(issues({ ...simple, price: '0' })).toContain('price');
    expect(issues({ ...simple, price: '1000001' })).toContain('price');
    expect(issues({ ...simple, price: '4.5' })).toContain('price');
    expect(issues({ ...simple, cost: '' })).toContain('cost');
    expect(issues({ ...simple, cost: '0' })).toEqual([]);
    expect(issues({ ...combo, price: '0' })).toContain('price');
  });
  it('un combo lleva 2 a 10 componentes distintos con cantidad 1 a 10', () => {
    expect(issues({ ...combo, components: [pick()] })).toContain('components');
    expect(issues({ ...combo, components: [pick(), pick()] })).toContain(
      'components',
    );
    expect(
      issues({
        ...combo,
        components: [pick(), pick({ productId: 'p2', quantity: 11 })],
      }),
    ).toContain('components');
    const eleven = Array.from({ length: 11 }, (_, i) =>
      pick({ productId: `p${String(i)}` }),
    );
    expect(issues({ ...combo, components: eleven })).toContain('components');
  });
});

describe('createBody', () => {
  it('un simple lleva precio y costo, sin componentes', () => {
    expect(createBody({ ...simple, description: ' Con leche ' })).toEqual({
      sku: 'CAF-1',
      name: 'Café',
      description: 'Con leche',
      category: 'cafe',
      price: 4500,
      cost: 1600,
    });
  });
  it('un combo no lleva costo; sin precio lo calcula el back', () => {
    const body = createBody(combo);
    expect(body).toEqual({
      sku: 'CMB-1',
      name: 'Café',
      category: 'combo',
      components: [
        { productId: 'p1', quantity: 1 },
        { productId: 'p2', quantity: 2 },
      ],
    });
    expect('cost' in body).toBe(false);
    expect(createBody({ ...combo, price: '7000' }).price).toBe(7000);
  });
});

describe('comboTotals', () => {
  it('suma precio y costo por cantidad', () => {
    expect(comboTotals(combo.components)).toEqual({ price: 7000, cost: 2000 });
    expect(comboTotals([])).toEqual({ price: 0, cost: 0 });
  });
});

describe('changedFields', () => {
  const original = backProduct({
    name: 'Café',
    description: null,
    price: 4500,
    cost: 1600,
  });
  it('envía solo lo modificado; sin cambios queda vacío', () => {
    const same = editValuesOf(original);
    expect(hasChanges(changedFields(original, same))).toBe(false);
    expect(
      changedFields(original, { ...same, name: ' Nuevo ', price: '5000' }),
    ).toEqual({
      name: 'Nuevo',
      price: 5000,
    });
  });
  it('descripción vacía envía null y solo si había una', () => {
    const withDesc = backProduct({ description: 'Hola' });
    expect(
      changedFields(withDesc, { ...editValuesOf(withDesc), description: '' }),
    ).toEqual({
      description: null,
    });
    expect(
      changedFields(original, { ...editValuesOf(original), description: '  ' }),
    ).toEqual({});
  });
  it('un combo no envía costo ni categoría', () => {
    const c = backProduct({ category: 'combo', cost: 2000 });
    const v = {
      ...editValuesOf(c),
      cost: '1',
      category: 'snack' as const,
      price: '9000',
    };
    expect(changedFields(c, v)).toEqual({ price: 9000 });
    expect(editSchema(c).safeParse({ ...v, cost: '' }).success).toBe(true);
  });
});

describe('formatCostPercent', () => {
  it('usa coma decimal', () => {
    expect(formatCostPercent(35.6)).toBe('35,6 % del precio');
    expect(formatCostPercent(null)).toBe('sin margen calculable');
  });
});
