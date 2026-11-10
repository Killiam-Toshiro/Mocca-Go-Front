'use client';

import { useState } from 'react';
import { CategoryIcon } from '@/components/menu/category-icon';
import { QuantityStepper } from '@/components/cart/quantity-stepper';
import { Button } from '@/components/ui/button';
import { DialogPanel } from '@/components/ui/dialog-panel';
import { MAX_LINES, MAX_QUANTITY, type Cart } from '@/lib/cart/cart';
import { categoryLabel, type MenuItem } from '@/lib/menu/categories';
import { formatCOP } from '@/lib/menu/format';
import type { AddStatus } from '@/lib/cart/cart';

const PROBLEM: Record<'max-quantity' | 'max-lines', string> = {
  'max-quantity': `El máximo es ${MAX_QUANTITY} unidades por producto.`,
  'max-lines': `Tu carrito ya tiene ${MAX_LINES} productos distintos.`,
};

/** Detalle de un producto: descripción, componentes del combo, cantidad y «Agregar». */
export function ProductDetail({
  item,
  canOrder,
  cart,
  onClose,
  onAdd,
}: {
  item: MenuItem | null;
  canOrder: boolean;
  cart: Cart;
  onClose: () => void;
  onAdd: (item: MenuItem, quantity: number) => AddStatus;
}) {
  return (
    <DialogPanel
      open={item !== null}
      onClose={onClose}
      title={item?.name ?? 'Producto'}
      variant="center"
    >
      {item ? (
        <DetailBody
          key={item.id}
          item={item}
          canOrder={canOrder}
          inCart={
            cart.find((line) => line.productId === item.id)?.quantity ?? 0
          }
          onClose={onClose}
          onAdd={onAdd}
        />
      ) : null}
    </DialogPanel>
  );
}

function DetailBody({
  item,
  canOrder,
  inCart,
  onClose,
  onAdd,
}: {
  item: MenuItem;
  canOrder: boolean;
  inCart: number;
  onClose: () => void;
  onAdd: (item: MenuItem, quantity: number) => AddStatus;
}) {
  const [quantity, setQuantity] = useState(1);
  const [problem, setProblem] = useState<string | null>(null);

  const add = () => {
    const status = onAdd(item, quantity);
    if (status === 'max-quantity' || status === 'max-lines')
      setProblem(PROBLEM[status]);
    else onClose();
  };

  return (
    <div className="grid gap-4 p-4">
      <div className="flex items-center gap-3">
        <span className="flex size-16 shrink-0 items-center justify-center rounded-xl bg-secondary text-brand-strong">
          <CategoryIcon category={item.category} className="size-8" />
        </span>
        <div className="grid gap-0.5">
          <p className="text-sm text-muted-foreground">
            {categoryLabel(item.category)}
          </p>
          <p className="text-xl font-semibold">{formatCOP(item.price)}</p>
        </div>
      </div>

      <p className="text-sm">{item.description ?? 'Sin descripción.'}</p>

      {item.components.length > 0 ? (
        <section aria-labelledby={`incluye-${item.id}`} className="grid gap-1">
          <h3 id={`incluye-${item.id}`} className="text-sm font-semibold">
            Incluye
          </h3>
          <ul className="text-sm text-muted-foreground">
            {item.components.map((component) => (
              <li key={component.name}>
                {component.quantity} × {component.name}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {!item.available ? (
        <p className="rounded-lg bg-secondary px-3 py-2 text-sm font-semibold text-muted-foreground">
          Agotado por ahora.
        </p>
      ) : canOrder ? (
        <div className="grid gap-3">
          {inCart > 0 ? (
            <p className="text-sm text-muted-foreground">
              Ya tienes {inCart} en tu carrito.
            </p>
          ) : null}
          <div className="flex items-center justify-between gap-3">
            <QuantityStepper
              value={quantity}
              onChange={(next) => {
                setProblem(null);
                setQuantity(next);
              }}
              label={item.name}
            />
            <Button type="button" onClick={add}>
              Agregar · {formatCOP(item.price * quantity)}
            </Button>
          </div>
          {problem ? (
            <p role="alert" className="text-sm text-destructive">
              {problem}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
