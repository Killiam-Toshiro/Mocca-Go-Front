'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  CATEGORY_FILTERS,
  STATE_FILTERS,
  type CategoryFilter,
  type StateFilter,
} from '@/lib/catalog/categories';

/** Búsqueda (SKU o nombre), categoría y estado; los tres los resuelve el servidor (DP-02). */
export function CatalogFilters({
  search,
  category,
  state,
  onSearch,
  onCategory,
  onState,
}: {
  search: string;
  category: CategoryFilter;
  state: StateFilter;
  onSearch: (value: string) => void;
  onCategory: (value: CategoryFilter) => void;
  onState: (value: StateFilter) => void;
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <div className="grid content-start gap-1.5">
        <Label htmlFor="catalog-search">Buscar producto</Label>
        <Input
          id="catalog-search"
          type="search"
          className="h-11"
          placeholder="SKU o nombre"
          maxLength={100}
          value={search}
          onChange={(e) => onSearch(e.target.value)}
        />
      </div>
      <div className="grid content-start gap-1.5">
        <Label htmlFor="catalog-category">Categoría</Label>
        <Select
          id="catalog-category"
          value={category}
          onChange={(e) => onCategory(e.target.value as CategoryFilter)}
        >
          {CATEGORY_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>
      <div className="grid content-start gap-1.5">
        <Label htmlFor="catalog-state">Estado</Label>
        <Select
          id="catalog-state"
          value={state}
          onChange={(e) => onState(e.target.value as StateFilter)}
        >
          {STATE_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
