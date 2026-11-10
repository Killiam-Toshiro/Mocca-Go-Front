import type { components } from '@/lib/api/schema';

export type MenuItem = components['schemas']['MenuItemResponse'];

/** Orden en que el back entrega las categorías y en que se muestran. */
export const CATEGORY_ORDER = [
  'combo',
  'cafe',
  'bebida',
  'panaderia',
  'pasteleria',
  'snack',
] as const;
export type KnownCategory = (typeof CATEGORY_ORDER)[number];

const LABEL: Record<KnownCategory, string> = {
  combo: 'Combos',
  cafe: 'Cafés',
  bebida: 'Bebidas',
  panaderia: 'Panadería',
  pasteleria: 'Pastelería',
  snack: 'Snacks',
};

export function isKnownCategory(category: string): category is KnownCategory {
  return (CATEGORY_ORDER as readonly string[]).includes(category);
}

/** Nombre en español; una categoría que el front aún no conoce se muestra tal cual. */
export function categoryLabel(category: string): string {
  return isKnownCategory(category) ? LABEL[category] : category;
}

export interface CategoryGroup {
  category: string;
  label: string;
  items: MenuItem[];
}

/** Agrupa conservando el orden de `CATEGORY_ORDER`; las desconocidas van al final por nombre. */
export function groupByCategory(items: readonly MenuItem[]): CategoryGroup[] {
  const groups = new Map<string, MenuItem[]>();
  for (const item of items) {
    const list = groups.get(item.category) ?? [];
    list.push(item);
    groups.set(item.category, list);
  }
  const known = CATEGORY_ORDER.filter((category) => groups.has(category));
  const unknown = [...groups.keys()]
    .filter((category) => !isKnownCategory(category))
    .sort((a, b) => a.localeCompare(b, 'es'));
  return [...known, ...unknown].map((category) => ({
    category,
    label: categoryLabel(category),
    items: groups.get(category) ?? [],
  }));
}
