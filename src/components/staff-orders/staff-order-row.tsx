import Link from 'next/link';
import { StatusBadge } from '@/components/orders/status-badge';
import { formatCOP } from '@/lib/menu/format';
import { formatOrderDate } from '@/lib/orders/format';
import type { Order } from '@/lib/orders/types';
import { deliveryLine } from '@/lib/staff-orders/format';

/** Una fila de la lista de pedidos del personal: toda la tarjeta lleva al detalle. */
export function StaffOrderRow({ order, base }: { order: Order; base: string }) {
  return (
    <li>
      <Link
        href={`${base}/pedidos/${order.id}`}
        className="grid gap-2 rounded-xl border bg-card p-4 shadow-sm transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-display text-lg font-semibold">
            Pedido #{order.number}
          </span>
          <StatusBadge status={order.status} />
        </div>
        <p className="text-sm">{order.customer.name}</p>
        <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm text-muted-foreground">
          <span>
            {formatOrderDate(order.createdAt)} · {deliveryLine(order)}
          </span>
          <span className="text-base font-semibold text-foreground tabular-nums">
            {formatCOP(order.total)}
          </span>
        </div>
      </Link>
    </li>
  );
}
