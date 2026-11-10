'use client';

import Link from 'next/link';
import { Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { QuantityStepper } from '@/components/cart/quantity-stepper';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DialogPanel } from '@/components/ui/dialog-panel';
import { reconcile, type ReconciledLine } from '@/lib/cart/cart';
import {
  acknowledgePrices,
  changeQuantity,
  clearCart,
  dismissNotice,
  removeFromCart,
} from '@/lib/cart/store';
import { useCartState } from '@/lib/cart/use-cart';
import type { MenuItem } from '@/lib/menu/categories';
import { formatCOP } from '@/lib/menu/format';

/** Quién mira el menú: decide qué hace el botón de seguir (D-034). */
export type Audience = 'visitante' | 'cliente' | 'personal';

export function CartPanel({
  open,
  onClose,
  audience,
  menu,
  menuFailed,
  onRetry,
}: {
  open: boolean;
  onClose: () => void;
  audience: Audience;
  menu: readonly MenuItem[] | undefined;
  menuFailed: boolean;
  onRetry: () => void;
}) {
  return (
    <DialogPanel open={open} onClose={onClose} title="Tu carrito">
      <CartContent
        audience={audience}
        menu={menu}
        menuFailed={menuFailed}
        onRetry={onRetry}
        onClose={onClose}
      />
    </DialogPanel>
  );
}

function CartContent({
  audience,
  menu,
  menuFailed,
  onRetry,
  onClose,
}: {
  audience: Audience;
  menu: readonly MenuItem[] | undefined;
  menuFailed: boolean;
  onRetry: () => void;
  onClose: () => void;
}) {
  const { cart, notices } = useCartState();
  const view = useMemo(() => reconcile(cart, menu), [cart, menu]);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const changed = view.rows.filter((row) => row.priceChanged);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="grid flex-1 content-start gap-3 overflow-y-auto p-4">
        {notices.map((notice) => (
          <Alert key={notice.id} role="status" className="grid gap-2">
            <p>{notice.text}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-self-start"
              onClick={() => dismissNotice(notice.id)}
            >
              Entendido
            </Button>
          </Alert>
        ))}

        {menuFailed && cart.length > 0 ? (
          <Alert variant="destructive" className="grid gap-2">
            <p>No pudimos actualizar los precios ni la disponibilidad.</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-self-start"
              onClick={onRetry}
            >
              Reintentar
            </Button>
          </Alert>
        ) : null}

        {changed.length > 0 && menu ? (
          <Alert role="status" className="grid gap-2">
            <p>
              Cambió el precio de{' '}
              {changed.map((row) => row.line.name).join(', ')}. El total ya usa
              el precio nuevo.
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-self-start"
              onClick={() => acknowledgePrices(menu)}
            >
              Entendido
            </Button>
          </Alert>
        ) : null}

        {cart.length === 0 ? (
          <div className="grid justify-items-start gap-3 py-6">
            <p className="text-muted-foreground">Tu carrito está vacío.</p>
            <Button type="button" variant="outline" onClick={onClose}>
              Ver el menú
            </Button>
          </div>
        ) : (
          <ul className="grid gap-3">
            {view.rows.map((row) => (
              <CartRow key={row.line.productId} row={row} />
            ))}
          </ul>
        )}
      </div>

      {cart.length > 0 ? (
        <footer className="grid gap-3 border-t p-4">
          <div className="flex items-baseline justify-between">
            <span className="font-semibold">Total</span>
            <span className="text-xl font-semibold">
              {menu ? formatCOP(view.subtotal) : '—'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Precio informativo: el total final se confirma al hacer el pedido.
          </p>
          {view.unavailableCount > 0 && menu ? (
            <p role="alert" className="text-sm text-destructive">
              Quita los productos agotados para continuar.
            </p>
          ) : null}

          {audience === 'visitante' ? (
            <Button asChild>
              <Link href="/login?next=/cliente/menu">Ingresar para pedir</Link>
            </Button>
          ) : (
            <div className="grid gap-1">
              <Button type="button" disabled aria-describedby="continuar-nota">
                Continuar
              </Button>
              <p
                id="continuar-nota"
                className="text-center text-xs text-muted-foreground"
              >
                Disponible pronto.
              </p>
            </div>
          )}

          {confirmingClear ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm">¿Vaciar el carrito?</span>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                onClick={() => {
                  clearCart();
                  setConfirmingClear(false);
                }}
              >
                Sí, vaciar
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setConfirmingClear(false)}
              >
                Cancelar
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-self-start"
              onClick={() => setConfirmingClear(true)}
            >
              Vaciar carrito
            </Button>
          )}
        </footer>
      ) : null}
    </div>
  );
}

function CartRow({ row }: { row: ReconciledLine }) {
  const name = row.item?.name ?? row.line.name;
  const counts = row.status === 'ok';
  return (
    <li className="grid gap-2 rounded-lg border p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="grid gap-0.5">
          <p className="font-semibold">{name}</p>
          <p className="text-sm text-muted-foreground">
            {formatCOP(row.unitPrice)} c/u
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={`Quitar ${name} del carrito`}
          onClick={() => removeFromCart(row.line.productId)}
        >
          <Trash2 aria-hidden />
        </Button>
      </div>
      {row.status === 'agotado' ? (
        <p className="text-sm font-semibold text-destructive">
          Agotado: no cuenta en el total.
        </p>
      ) : null}
      {row.status === 'retirado' ? (
        <p className="text-sm font-semibold text-destructive">
          Ya no está en el menú.
        </p>
      ) : null}
      <div className="flex items-center justify-between gap-3">
        <QuantityStepper
          value={row.line.quantity}
          onChange={(next) => changeQuantity(row.line.productId, next)}
          label={name}
        />
        <span className="font-semibold tabular-nums">
          {counts ? formatCOP(row.lineTotal) : '—'}
        </span>
      </div>
    </li>
  );
}
