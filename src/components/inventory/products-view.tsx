'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { useFilteredProducts } from '@/lib/inventory/use-filtered-products';
import { Freshness } from './freshness';
import { ProductFilters } from './product-filters';
import { ProductList } from './product-list';
import { ProductRow } from './product-row';

/** «Productos»: disponibilidad rápida, con el interruptor «agotado» (D-065, D-067). */
export function ProductsView() {
  const board = useFilteredProducts();
  const { query, filter, setFilter } = board;
  const [done, setDone] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="font-display text-3xl font-semibold">Productos</h1>
        <Freshness
          updatedAt={query.dataUpdatedAt}
          fetching={query.isFetching}
          onRefresh={() => void query.refetch()}
        />
      </div>

      <p
        role="status"
        aria-live="polite"
        className="min-h-5 text-sm font-medium"
      >
        {done}
      </p>
      {notice ? (
        <Alert
          variant="destructive"
          className="flex items-center justify-between gap-3"
        >
          <p>{notice}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setNotice(null)}
          >
            Entendido
          </Button>
        </Alert>
      ) : null}

      <ProductFilters filter={filter} onChange={setFilter} />
      <ProductList
        board={board}
        render={(product) => (
          <ProductRow
            key={product.id}
            product={product}
            onChanged={(p) =>
              setDone(
                p.soldOut
                  ? `${p.name} ya no se puede pedir.`
                  : `${p.name} vuelve a venderse.`,
              )
            }
            onStale={(p, message) => setNotice(`${p.name}: ${message}`)}
          />
        )}
      />
    </div>
  );
}
