'use client';

import Link from 'next/link';
import { useEffect, useRef } from 'react';
import { CancelOrder } from '@/components/orders/cancel-order';
import { CourierCard } from '@/components/orders/courier-card';
import { OrderTimeline } from '@/components/orders/order-timeline';
import { StatusBadge } from '@/components/orders/status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { describeApiError, isApiError } from '@/lib/api/errors';
import { formatCOP } from '@/lib/menu/format';
import { formatOrderDate } from '@/lib/orders/format';
import { useOrder } from '@/lib/orders/use-order';

const CARD = 'grid gap-3 rounded-xl border bg-card p-4';
const TITLE = 'font-display text-xl font-semibold';

/** Detalle del pedido: estado, productos, entrega, pago e historial (D-043). */
export function OrderDetailView({
  id,
  isNew = false,
}: {
  id: string;
  /** Venimos de pagar: se celebra y se anuncia. */
  isNew?: boolean;
}) {
  const query = useOrder(id);
  const order = query.data;
  const orderId = order?.id;
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (isNew && orderId) heading.current?.focus();
  }, [isNew, orderId]);

  if (query.isPending) {
    return (
      <div
        aria-busy="true"
        aria-label="Cargando el pedido"
        className="grid gap-4"
      >
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (query.isError || !order) {
    const notFound =
      isApiError(query.error) &&
      (query.error.status === 404 || query.error.status === 400);
    return (
      <div className="grid justify-items-start gap-3">
        <h1 className="font-display text-3xl font-semibold">Pedido</h1>
        {notFound ? (
          <p>No encontramos este pedido.</p>
        ) : (
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
        )}
        <Button asChild variant="outline">
          <Link href="/cliente/pedidos">Ver mis pedidos</Link>
        </Button>
      </div>
    );
  }

  const { delivery, payment } = order;
  return (
    <div className="grid gap-6">
      {isNew ? (
        <Alert role="status" className="font-semibold">
          ¡Pedido #{order.number} recibido! Te avisaremos cuando cambie de
          estado.
        </Alert>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1
          ref={heading}
          tabIndex={-1}
          className="font-display text-3xl font-semibold outline-none"
        >
          Pedido #{order.number}
        </h1>
        <StatusBadge status={order.status} className="text-sm" />
      </div>
      <p className="-mt-4 text-sm text-muted-foreground">
        {formatOrderDate(order.createdAt)}
      </p>

      {order.cancelReason ? (
        <Alert>Motivo de la cancelación: {order.cancelReason}</Alert>
      ) : null}
      {order.failureReason ? (
        <Alert variant="destructive">
          No pudimos entregar tu pedido: {order.failureReason}
        </Alert>
      ) : null}

      {order.status === 'en_camino' ? (
        <CourierCard delivery={delivery} />
      ) : null}

      <section aria-labelledby="productos-titulo" className={CARD}>
        <h2 id="productos-titulo" className={TITLE}>
          Productos
        </h2>
        <ul className="grid gap-3">
          {order.items.map((item) => (
            <li key={item.productId} className="grid gap-0.5">
              <div className="flex items-baseline justify-between gap-3">
                <span>
                  {item.quantity} × {item.name}
                </span>
                <span className="tabular-nums">
                  {formatCOP(item.lineTotal)}
                </span>
              </div>
              {item.components.length > 0 ? (
                <p className="text-sm text-muted-foreground">
                  Incluye:{' '}
                  {item.components
                    .map((c) => `${c.quantity} × ${c.name}`)
                    .join(', ')}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="flex items-baseline justify-between border-t pt-3">
          <span className="font-semibold">Total</span>
          <span className="text-xl font-semibold tabular-nums">
            {formatCOP(order.total)}
          </span>
        </div>
      </section>

      <section aria-labelledby="entrega-titulo" className={CARD}>
        <h2 id="entrega-titulo" className={TITLE}>
          Entrega
        </h2>
        <p>
          {delivery.zoneName} · {delivery.pointName}
          {delivery.floor !== null ? ` · Piso ${delivery.floor}` : ''}
        </p>
        {delivery.deliveryNote ? (
          <p className="text-sm text-muted-foreground">
            Indicación: {delivery.deliveryNote}
          </p>
        ) : null}
        {order.note ? (
          <p className="text-sm text-muted-foreground">Nota: {order.note}</p>
        ) : null}
      </section>

      <section aria-labelledby="pago-titulo" className={CARD}>
        <h2 id="pago-titulo" className={TITLE}>
          Pago
        </h2>
        <p>
          Tarjeta de prueba ···· {payment.last4} ·{' '}
          <strong>
            {payment.status === 'reembolsado' ? 'Reembolsado' : 'Aprobado'}
          </strong>
        </p>
      </section>

      <section aria-labelledby="historial-titulo" className={CARD}>
        <h2 id="historial-titulo" className={TITLE}>
          Seguimiento
        </h2>
        <OrderTimeline events={order.events} />
      </section>

      <CancelOrder orderId={order.id} status={order.status} />

      <Button asChild variant="outline" className="justify-self-start">
        <Link href="/cliente/pedidos">Ver mis pedidos</Link>
      </Button>
    </div>
  );
}
