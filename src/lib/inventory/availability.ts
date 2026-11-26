import type { Category, StaffProduct } from './types';

export type AvailabilityKey =
  | 'disponible'
  | 'agotado'
  | 'sin_saldo'
  | 'inactivo'
  | 'falta_componente'
  | 'no_disponible';

export interface Availability {
  key: AvailabilityKey;
  label: string;
}

export const isCombo = (product: Pick<StaffProduct, 'category'>): boolean =>
  product.category === 'combo';

/** Resume en palabras por qué un producto se puede o no pedir (D-066). */
export function availability(
  product: Pick<
    StaffProduct,
    'active' | 'soldOut' | 'available' | 'stock' | 'category'
  >,
): Availability {
  if (!product.active) return { key: 'inactivo', label: 'Inactivo' };
  if (product.soldOut) return { key: 'agotado', label: 'Agotado' };
  if (product.available) return { key: 'disponible', label: 'Disponible' };
  if (product.stock <= 0)
    return isCombo(product)
      ? { key: 'falta_componente', label: 'Falta saldo de un componente' }
      : { key: 'sin_saldo', label: 'Sin saldo' };
  return { key: 'no_disponible', label: 'No disponible' };
}

export const CATEGORY_LABEL: Record<Category, string> = {
  combo: 'Combos',
  cafe: 'Café',
  bebida: 'Bebidas',
  panaderia: 'Panadería',
  pasteleria: 'Pastelería',
  snack: 'Snacks',
};

export const CATEGORIES = Object.keys(CATEGORY_LABEL) as Category[];

export type StatusFilter = 'todos' | 'agotados';

export interface ProductFilter {
  search: string;
  category: Category | 'todas';
  status: StatusFilter;
}

export const NO_FILTER: ProductFilter = {
  search: '',
  category: 'todas',
  status: 'todos',
};

const normalize = (text: string): string =>
  text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

/** «Agotados» reúne lo que hoy no se puede vender por falta de producto. */
const OUT: AvailabilityKey[] = ['agotado', 'sin_saldo', 'falta_componente'];

export function matchesFilter(
  product: StaffProduct,
  filter: ProductFilter,
): boolean {
  if (filter.category !== 'todas' && product.category !== filter.category)
    return false;
  if (filter.status === 'agotados' && !OUT.includes(availability(product).key))
    return false;
  const search = normalize(filter.search);
  if (search === '') return true;
  return (
    normalize(product.name).includes(search) ||
    normalize(product.sku).includes(search)
  );
}
