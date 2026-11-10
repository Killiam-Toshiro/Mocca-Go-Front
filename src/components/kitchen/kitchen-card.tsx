'use client';

import { MessageSquareText, Phone } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { CancelKitchenOrder } from '@/components/kitchen/cancel-kitchen-order';
import { WaitBadge } from '@/components/kitchen/wait-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { sinceFor, telHref, waitMinutes } from '@/lib/kitchen/board';
import { describeKitchenError } from '@/lib/kitchen/errors';
import { useKitchenAction } from '@/lib/kitchen/use-kitchen-action';
import type { Order } from '@/lib/orders/types';

/** Pedido por preparar o en preparación, con sus acciones (D-057, D-058, D-059). */
export function KitchenCard({
  order,
  status,
  now,
  focus,
  onActed,
  onStale,
}: {
  order: Order;
  status: 'recibido' | 'en_preparacion';
  now: number;
  /** Tras mover el pedido de columna, su tarjeta recibe el foco. */
  focus: boolean;
  onActed: (order: Order) => void;
  /** El pedido cambió o ya no existe: el aviso vive en la pantalla porque la tarjeta se mueve. */
  onStale: (order: Order, message: string) => void;
}) {
  const action = useKitchenAction(
    status === 'recibido' ? 'start' : 'ready',
    onActed,
    (error) => {
      const e = describeKitchenError(error);
      if (e.kind === 'conflict' || e.kind === 'missing')
        onStale(order, e.messages.join(' '));
    },
  );
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);

  const described = action.isError ? describeKitchenError(action.error) : null;
  const failure =
    described && described.kind !== 'conflict' && described.kind !== 'missing'
      ? described
      : null;
  const tel = telHref(order.customer.phone);
  const { delivery } = order;
  const where = [
    delivery.zoneName,
    delivery.pointName,
    delivery.floor === null ? null : `Piso ${String(delivery.floor)}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const label = status === 'recibido' ? 'Empezar' : 'Marcar listo';

  // `isPending` se actualiza con un pequeño retraso: la marca síncrona evita el doble envío.
  const busy = useRef(false);
  function run() {
    if (busy.current) return;
    busy.current = true;
    action.mutate(order.id, {
      onSettled: () => {
        busy.current = false;
      },
    });
  }

  return (
    <li>
      <article
        ref={ref}
        tabIndex={-1}
        aria-labelledby={`order-${order.id}`}
        className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3
            id={`order-${order.id}`}
            className="font-display text-2xl font-semibold"
          >
            Pedido #{order.number}
          </h3>
          <WaitBadge
            status={status}
            minutes={waitMinutes(sinceFor(order), now)}
          />
        </div>

        <ul className="grid gap-1.5 text-lg">
          {order.items.map((item) => (
            <li key={item.productId}>
              <span className="font-semibold">
                {item.quantity} × {item.name}
              </span>
              {item.components.length > 0 ? (
                <span className="block text-sm text-muted-foreground">
                  Incluye:{' '}
                  {item.components
                    .map((c) => `${String(c.quantity)} × ${c.name}`)
                    .join(', ')}
                </span>
              ) : null}
            </li>
          ))}
        </ul>

        {order.note ? (
          <p className="flex items-start gap-2 rounded-lg bg-secondary px-3 py-2 text-secondary-foreground">
            <MessageSquareText className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <strong>Nota:</strong> {order.note}
            </span>
          </p>
        ) : null}

        <div className="grid gap-0.5 text-sm text-muted-foreground">
          <p>{where}</p>
          <p className="flex flex-wrap items-center gap-x-2">
            <span>{order.customer.name}</span>
            {tel ? (
              <a
                href={tel}
                className="inline-flex items-center gap-1 text-brand-strong underline underline-offset-2"
              >
                <Phone className="size-3.5" aria-hidden />
                {order.customer.phone}
              </a>
            ) : (
              <span>{order.customer.phone}</span>
            )}
          </p>
        </div>

        {failure ? (
          <Alert variant="destructive" className="grid gap-2">
            <p>{failure.messages.join(' ')}</p>
            {failure.kind === 'network' || failure.kind === 'other' ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="justify-self-start"
                onClick={run}
              >
                Reintentar
              </Button>
            ) : null}
          </Alert>
        ) : null}

        <div className="flex flex-wrap items-start gap-2">
          <Button
            type="button"
            className="h-12 min-w-36 text-base"
            disabled={action.isPending}
            aria-label={`${label} el pedido ${String(order.number)}`}
            onClick={run}
          >
            {action.isPending ? 'Enviando…' : label}
          </Button>
          <CancelKitchenOrder
            order={order}
            onDone={onActed}
            onStale={(message) => onStale(order, message)}
          />
        </div>
      </article>
    </li>
  );
}
