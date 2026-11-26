'use client';

import { useState } from 'react';
import { matchesFilter, NO_FILTER, type ProductFilter } from './availability';
import { useProducts } from './use-products';

/** El catálogo con los filtros de búsqueda, categoría y estado aplicados en el navegador. */
export function useFilteredProducts() {
  const query = useProducts();
  const [filter, setFilter] = useState<ProductFilter>(NO_FILTER);
  const all = query.data?.data ?? [];
  const shown = all.filter((p) => matchesFilter(p, filter));
  return { query, filter, setFilter, all, shown };
}
