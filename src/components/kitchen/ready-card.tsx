'use client';

import { useEffect, useRef } from 'react';
import { WaitBadge } from '@/components/kitchen/wait-badge';
import { sinceFor, waitMinutes } from '@/lib/kitchen/board';
import type { Order } from '@/lib/orders/types';

/** Pedido listo que espera al repartidor: tarjeta compacta (D-056). */
export function ReadyCard({
  order,
  now,
  focus,
}: {
  order: Order;
  now: number;
  focus: boolean;
}) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (focus) ref.current?.focus();
  }, [focus]);

  const summary = order.items
    .map((item) => `${String(item.quantity)} × ${item.name}`)
    .join(', ');
  return (
    <li>
      <article
        ref={ref}
        tabIndex={-1}
        aria-labelledby={`order-${order.id}`}
        className="grid gap-1 rounded-xl border bg-card px-4 py-3 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3
            id={`order-${order.id}`}
            className="font-display text-lg font-semibold"
          >
            Pedido #{order.number}
          </h3>
          <WaitBadge
            status="listo"
            minutes={waitMinutes(sinceFor(order), now)}
          />
        </div>
        <p className="truncate text-sm text-muted-foreground">{summary}</p>
        <p className="text-sm text-muted-foreground">{order.customer.name}</p>
      </article>
    </li>
  );
}
