import { describe, expect, it } from 'vitest';
import {
  categoryLabel,
  groupByCategory,
  isKnownCategory,
  type MenuItem,
} from './categories';

const item = (id: string, category: string, name = id): MenuItem =>
  ({
    id,
    sku: id,
    name,
    description: null,
    category,
    price: 1000,
    available: true,
    components: [],
  }) as MenuItem;

describe('categorías', () => {
  it('traduce las seis categorías del back', () => {
    expect(
      ['combo', 'cafe', 'bebida', 'panaderia', 'pasteleria', 'snack'].map(
        categoryLabel,
      ),
    ).toEqual([
      'Combos',
      'Cafés',
      'Bebidas',
      'Panadería',
      'Pastelería',
      'Snacks',
    ]);
  });

  it('una categoría desconocida se muestra tal cual y no es «conocida»', () => {
    expect(categoryLabel('almuerzos')).toBe('almuerzos');
    expect(isKnownCategory('almuerzos')).toBe(false);
    expect(isKnownCategory('cafe')).toBe(true);
  });

  it('agrupa en el orden del back y deja las desconocidas al final', () => {
    const groups = groupByCategory([
      item('s1', 'snack'),
      item('z1', 'zeta'),
      item('c1', 'cafe'),
      item('a1', 'almuerzos'),
      item('c2', 'cafe'),
      item('k1', 'combo'),
    ]);
    expect(groups.map((g) => g.category)).toEqual([
      'combo',
      'cafe',
      'snack',
      'almuerzos',
      'zeta',
    ]);
    expect(groups[1]!.items.map((i) => i.id)).toEqual(['c1', 'c2']);
    expect(groups[3]!.label).toBe('almuerzos');
  });

  it('sin productos no hay grupos', () => {
    expect(groupByCategory([])).toEqual([]);
  });
});
