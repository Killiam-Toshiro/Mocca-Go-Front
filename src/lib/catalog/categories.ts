import { CATEGORIES, CATEGORY_LABEL } from '@/lib/inventory/availability';
import type { Category, SimpleCategory } from './types';

export { CATEGORY_LABEL };
export const SIMPLE_CATEGORIES = CATEGORIES.filter(
  (c): c is SimpleCategory => c !== 'combo',
);

export type CategoryFilter = Category | 'todas';
export type StateFilter = 'todos' | 'activos' | 'inactivos';

export const CATEGORY_FILTERS: { value: CategoryFilter; label: string }[] = [
  { value: 'todas', label: 'Todas las categorías' },
  ...CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] })),
];

export const STATE_FILTERS: { value: StateFilter; label: string }[] = [
  { value: 'todos', label: 'Todos' },
  { value: 'activos', label: 'Activos' },
  { value: 'inactivos', label: 'Inactivos' },
];
