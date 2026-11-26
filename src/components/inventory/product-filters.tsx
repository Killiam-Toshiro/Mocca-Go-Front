'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  CATEGORIES,
  CATEGORY_LABEL,
  type ProductFilter,
  type StatusFilter,
} from '@/lib/inventory/availability';
import type { Category } from '@/lib/inventory/types';

/** Búsqueda por nombre o SKU, categoría y «agotados o sin saldo». */
export function ProductFilters({
  filter,
  onChange,
}: {
  filter: ProductFilter;
  onChange: (next: ProductFilter) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="grid gap-1.5">
        <Label htmlFor="filter-search">Buscar producto</Label>
        <Input
          id="filter-search"
          type="search"
          className="h-11"
          placeholder="Nombre o SKU"
          value={filter.search}
          onChange={(e) => onChange({ ...filter, search: e.target.value })}
        />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="filter-category">Categoría</Label>
        <Select
          id="filter-category"
          value={filter.category}
          onChange={(e) =>
            onChange({
              ...filter,
              category: e.target.value as Category | 'todas',
            })
          }
        >
          <option value="todas">Todas</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="filter-status">Estado</Label>
        <Select
          id="filter-status"
          value={filter.status}
          onChange={(e) =>
            onChange({ ...filter, status: e.target.value as StatusFilter })
          }
        >
          <option value="todos">Todos</option>
          <option value="agotados">Agotados o sin saldo</option>
        </Select>
      </div>
    </div>
  );
}
