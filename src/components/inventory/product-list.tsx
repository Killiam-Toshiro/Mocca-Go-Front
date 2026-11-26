'use client';

import type { ReactNode } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { describeApiError } from '@/lib/api/errors';
import type { useFilteredProducts } from '@/lib/inventory/use-filtered-products';
import type { StaffProduct } from '@/lib/inventory/types';
import { PRODUCTS_LIMIT } from '@/lib/inventory/use-products';

/** Estados de carga, error, vacío y «más de 100» comunes a «Productos» y «Saldos». */
export function ProductList({
  board,
  render,
}: {
  board: ReturnType<typeof useFilteredProducts>;
  render: (product: StaffProduct) => ReactNode;
}) {
  const { query, shown, all } = board;
  if (query.isPending) {
    return (
      <div
        aria-busy="true"
        aria-label="Cargando productos"
        className="grid gap-3"
      >
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }
  if (query.isError && !query.data) {
    return (
      <Alert variant="destructive" className="grid gap-2">
        {describeApiError(query.error).map((line) => (
          <p key={line}>{line}</p>
        ))}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="justify-self-start"
          onClick={() => void query.refetch()}
        >
          Reintentar
        </Button>
      </Alert>
    );
  }
  const total = query.data?.total ?? 0;
  return (
    <div className="grid gap-3">
      {shown.length === 0 ? (
        <p className="text-muted-foreground">
          {all.length === 0
            ? 'Todavía no hay productos.'
            : 'Ningún producto coincide con los filtros.'}
        </p>
      ) : (
        <ul className="grid gap-3">{shown.map(render)}</ul>
      )}
      {total > all.length ? (
        <p className="text-sm text-muted-foreground">
          Mostrando los {PRODUCTS_LIMIT} primeros de {total}.
        </p>
      ) : null}
    </div>
  );
}
