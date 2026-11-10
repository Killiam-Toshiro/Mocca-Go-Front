'use client';

import { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { isCombo, CATEGORY_LABEL } from '@/lib/inventory/availability';
import { STOCK_LABEL } from '@/lib/inventory/labels';
import type { CreatedMovement, StaffProduct } from '@/lib/inventory/types';
import { MovementForm } from './movement-form';
import { StatusBadge } from './status-badge';

/** Una fila de «Saldos»: saldo y la acción «Registrar movimiento» (no en combos, D-071). */
export function StockRow({
  product,
  open,
  focus,
  onOpen,
  onClose,
  onCreated,
  onStale,
  onViewHistory,
}: {
  product: StaffProduct;
  open: boolean;
  /** Tras cerrar el formulario, el botón de la fila recibe el foco. */
  focus: boolean;
  onOpen: () => void;
  onClose: () => void;
  onCreated: (created: CreatedMovement) => void;
  onStale: (product: StaffProduct, message: string) => void;
  onViewHistory: () => void;
}) {
  const button = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (focus) button.current?.focus();
  }, [focus]);

  const combo = isCombo(product);
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
      {combo ? (
        <p className="text-sm text-muted-foreground">
          Se calcula con sus componentes
        </p>
      ) : !product.active ? (
        <p className="text-sm text-muted-foreground">
          Inactivo: sin movimientos
        </p>
      ) : (
        <Button
          ref={button}
          type="button"
          variant="outline"
          className="h-12 text-base"
          aria-expanded={open}
          aria-label={`Registrar movimiento de ${product.name}`}
          onClick={open ? onClose : onOpen}
        >
          Registrar movimiento
        </Button>
      )}
      {open ? (
        <div className="md:col-span-4">
          <MovementForm
            product={product}
            onCreated={onCreated}
            onCancel={onClose}
            onStale={(message) => onStale(product, message)}
            onViewHistory={onViewHistory}
          />
        </div>
      ) : null}
    </li>
  );
}
