import Link from 'next/link';
import { StatusBadge } from '@/components/orders/status-badge';
import { formatCOP } from '@/lib/menu/format';
import { formatOrderDate } from '@/lib/orders/format';
import type { Order } from '@/lib/orders/types';

/** Una fila de «Mis pedidos»: toda la tarjeta es el enlace al detalle. */
export function OrderRow({ order }: { order: Order }) {
  const units = order.items.reduce((sum, item) => sum + item.quantity, 0);
  return (
    <li>
      <Link
        href={`/cliente/pedidos/${order.id}`}
        className="grid gap-2 rounded-xl border bg-card p-4 shadow-sm transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-display text-lg font-semibold">
            Pedido #{order.number}
          </span>
          <StatusBadge status={order.status} />
        </div>
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {formatOrderDate(order.createdAt)} · {units}{' '}
            {units === 1 ? 'producto' : 'productos'}
          </span>
          <span className="text-base font-semibold text-foreground tabular-nums">
            {formatCOP(order.total)}
          </span>
        </div>
      </Link>
    </li>
  );
}
