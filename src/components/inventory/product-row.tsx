'use client';

import { Ban, Undo2 } from 'lucide-react';
import { useRef } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { CATEGORY_LABEL } from '@/lib/inventory/availability';
import { describeInventoryError } from '@/lib/inventory/errors';
import { STOCK_LABEL } from '@/lib/inventory/labels';
import type { StaffProduct } from '@/lib/inventory/types';
import { useSetSoldOut } from '@/lib/inventory/use-sold-out';
import { StatusBadge } from './status-badge';

/** Una fila de «Productos»: estado, saldo y el interruptor «agotado» (D-067). */
export function ProductRow({
  product,
  onChanged,
  onStale,
}: {
  product: StaffProduct;
  onChanged: (product: StaffProduct) => void;
  /** El producto ya no existe: el aviso vive en la pantalla porque la fila puede desaparecer. */
  onStale: (product: StaffProduct, message: string) => void;
}) {
  const action = useSetSoldOut(onChanged, (error) => {
    const e = describeInventoryError(error);
    if (e.kind === 'missing') onStale(product, e.messages.join(' '));
  });
  const described = action.isError
    ? describeInventoryError(action.error)
    : null;
  const failure = described && described.kind !== 'missing' ? described : null;

  // `isPending` se actualiza con un pequeño retraso: la marca síncrona evita el doble envío.
  const busy = useRef(false);
  function toggle() {
    if (busy.current) return;
    busy.current = true;
    action.mutate(
      { id: product.id, soldOut: !product.soldOut },
      {
        onSettled: () => {
          busy.current = false;
        },
      },
    );
  }

  const soldOut = product.soldOut;
  return (
    <li className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm md:grid-cols-[minmax(0,2fr)_auto_5rem_auto] md:items-center">
      <div className="min-w-0">
        <h3 className="font-display text-lg font-semibold">{product.name}</h3>
        <p className="text-sm text-muted-foreground">
          {product.sku} · {CATEGORY_LABEL[product.category]}
        </p>
      </div>
      <StatusBadge product={product} className="justify-self-start" />
      <p className="text-sm text-muted-foreground md:text-right">
        {STOCK_LABEL}{' '}
        <span className="text-base font-semibold text-foreground tabular-nums">
          {product.stock}
        </span>
      </p>
      {product.active ? (
        <Button
          type="button"
          variant={soldOut ? 'default' : 'outline'}
          className="h-12 text-base"
          aria-label={`${soldOut ? 'Volver a vender' : 'Marcar agotado'} ${product.name}`}
          onClick={toggle}
        >
          {soldOut ? <Undo2 aria-hidden /> : <Ban aria-hidden />}
          {soldOut ? 'Volver a vender' : 'Marcar agotado'}
        </Button>
      ) : (
        <p className="text-sm text-muted-foreground">
          Lo gestiona el administrador
        </p>
      )}
      {failure ? (
        <Alert variant="destructive" className="grid gap-2 md:col-span-4">
          <p>{failure.messages.join(' ')}</p>
          {failure.kind === 'network' || failure.kind === 'other' ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-self-start"
              onClick={toggle}
            >
              Reintentar
            </Button>
          ) : null}
        </Alert>
      ) : null}
    </li>
  );
}
