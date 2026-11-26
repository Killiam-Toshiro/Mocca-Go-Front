'use client';

import { Ban, Pencil, Undo2 } from 'lucide-react';
import { useState } from 'react';
import { StatusBadge } from '@/components/inventory/status-badge';
import { Button } from '@/components/ui/button';
import { CATEGORY_LABEL } from '@/lib/catalog/categories';
import { formatCostPercent } from '@/lib/catalog/schemas';
import type { Product } from '@/lib/catalog/types';
import { useCatalogSoldOut } from '@/lib/catalog/use-product-actions';
import { formatCOP } from '@/lib/menu/format';
import { CatalogNotice } from './catalog-notice';
import { StatusControl } from './status-control';

function Row({
  product,
  onEdit,
  onChanged,
  onMissing,
}: {
  product: Product;
  onEdit: (product: Product) => void;
  onChanged: (product: Product, message: string) => void;
  onMissing: (messages: string[]) => void;
}) {
  const [failure, setFailure] = useState<string[]>([]);
  const soldOut = useCatalogSoldOut({
    onDone: (p) =>
      onChanged(
        p,
        p.soldOut
          ? `${p.name} quedó marcado como agotado.`
          : `${p.name} volvió a venderse.`,
      ),
    onFail: (error) => {
      if (error.kind === 'missing') return onMissing(error.messages);
      setFailure(error.messages);
    },
  });
  const combo = product.category === 'combo';
  return (
    <li className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm md:grid-cols-[minmax(0,2fr)_auto_minmax(0,1.2fr)] md:items-center md:gap-4">
      <div className="min-w-0">
        <h3 className="font-display text-lg font-semibold break-words">
          {product.name}
          {combo ? (
            <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
              Combo
            </span>
          ) : null}
        </h3>
        <p className="text-sm text-muted-foreground">
          {product.sku} · {CATEGORY_LABEL[product.category]}
        </p>
        {combo ? (
          <p className="text-sm break-words text-muted-foreground">
            Lleva:{' '}
            {product.components
              .map((c) => `${String(c.quantity)} × ${c.name}`)
              .join(', ')}
          </p>
        ) : null}
      </div>
      <StatusBadge product={product} className="justify-self-start" />
      <div className="grid gap-0.5 text-sm md:text-right">
        <p className="text-base font-semibold tabular-nums">
          {formatCOP(product.price)}
        </p>
        <p className="text-muted-foreground">
          Costo {formatCOP(product.cost)} ·{' '}
          {formatCostPercent(product.costPercent)}
        </p>
      </div>
      <div className="flex flex-wrap gap-2 md:col-span-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-12"
          aria-label={`Editar ${product.name}`}
          onClick={() => onEdit(product)}
        >
          <Pencil aria-hidden />
          Editar
        </Button>
        {product.active ? (
          <Button
            type="button"
            variant={product.soldOut ? 'default' : 'outline'}
            className="min-h-12"
            disabled={soldOut.pending}
            aria-label={`${product.soldOut ? 'Volver a vender' : 'Marcar agotado'} ${product.name}`}
            onClick={() => {
              setFailure([]);
              void soldOut.run({ product, soldOut: !product.soldOut });
            }}
          >
            {product.soldOut ? <Undo2 aria-hidden /> : <Ban aria-hidden />}
            {product.soldOut ? 'Volver a vender' : 'Marcar agotado'}
          </Button>
        ) : null}
        <StatusControl
          product={product}
          onMissing={onMissing}
          onChanged={(p) =>
            onChanged(
              p,
              p.active ? `${p.name} está activo.` : `${p.name} está inactivo.`,
            )
          }
        />
      </div>
      <div className="md:col-span-3">
        <CatalogNotice messages={failure} onDismiss={() => setFailure([])} />
      </div>
    </li>
  );
}

/** Una fila por producto: tarjeta en celular y tres zonas desde `md` (DP-01). */
export function CatalogList({
  products,
  onEdit,
  onChanged,
  onMissing,
}: {
  products: Product[];
  onEdit: (product: Product) => void;
  onChanged: (product: Product, message: string) => void;
  onMissing: (messages: string[]) => void;
}) {
  return (
    <ul aria-label="Catálogo" className="grid gap-3">
      {products.map((p) => (
        <Row
          key={p.id}
          product={p}
          onEdit={onEdit}
          onChanged={onChanged}
          onMissing={onMissing}
        />
      ))}
    </ul>
  );
}
