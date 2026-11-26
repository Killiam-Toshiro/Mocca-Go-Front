'use client';

import Link from 'next/link';
import { useState } from 'react';
import { ContactLinks } from '@/components/dispatch/contact-links';
import { CancelKitchenOrder } from '@/components/kitchen/cancel-kitchen-order';
import { OrderTimeline } from '@/components/orders/order-timeline';
import { StatusBadge } from '@/components/orders/status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { describeApiError, isApiError } from '@/lib/api/errors';
import { formatCOP } from '@/lib/menu/format';
import { formatOrderDate, formatTime } from '@/lib/orders/format';
import { deliveryLine } from '@/lib/staff-orders/format';
import { canCancel } from '@/lib/staff-orders/filters';
import { useStaffOrder } from '@/lib/staff-orders/use-staff-order';

const CARD = 'grid gap-3 rounded-xl border bg-card p-4';
const TITLE = 'font-display text-xl font-semibold';

/** Detalle de un pedido para el personal: cliente, productos, entrega, pago, historial y cancelar (D-120, D-121). */
export function StaffOrderDetail({ id, base }: { id: string; base: string }) {
  const query = useStaffOrder(id);
  const [stale, setStale] = useState<string | null>(null);
  const order = query.data;
  const back = (
    <Button asChild variant="outline" className="justify-self-start">
      <Link href={`${base}/pedidos`}>Ver pedidos</Link>
    </Button>
  );

  if (query.isPending) {
    return (
      <div
        aria-busy="true"
        aria-label="Cargando el pedido"
        className="mx-auto grid w-full max-w-2xl gap-4"
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
      <div className="mx-auto grid w-full max-w-2xl justify-items-start gap-3">
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
        {back}
      </div>
    );
  }

  const { delivery, payment } = order;
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">
          Pedido #{order.number}
        </h1>
        <StatusBadge status={order.status} className="text-sm" />
      </div>
      <p className="-mt-4 text-sm text-muted-foreground">
        {formatOrderDate(order.createdAt)}
      </p>

      {stale ? (
        <Alert role="status" className="grid gap-2">
          <p>{stale}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => setStale(null)}
          >
            Entendido
          </Button>
        </Alert>
      ) : null}
      {order.cancelReason ? (
        <Alert>Motivo de la cancelación: {order.cancelReason}</Alert>
      ) : null}
      {order.failureReason ? (
        <Alert variant="destructive">
          No se pudo entregar: {order.failureReason}
        </Alert>
      ) : null}

      <section aria-labelledby="cliente-titulo" className={CARD}>
        <h2 id="cliente-titulo" className={TITLE}>
          Cliente
        </h2>
        <ContactLinks name={order.customer.name} phone={order.customer.phone} />
      </section>

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
        <p>{deliveryLine(order)}</p>
        {delivery.deliveryNote ? (
          <p className="text-sm text-muted-foreground">
            Indicación: {delivery.deliveryNote}
          </p>
        ) : null}
        {order.note ? (
          <p className="text-sm text-muted-foreground">Nota: {order.note}</p>
        ) : null}
        {delivery.courier ? (
          <p className="text-sm">
            Repartidor: <strong>{delivery.courier.fullName}</strong>
            {delivery.courier.phone ? ` · ${delivery.courier.phone}` : ''}
            {delivery.etaAt
              ? ` · Llegada estimada ${formatTime(delivery.etaAt)}`
              : ''}
          </p>
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

      {order.survey ? (
        <section aria-labelledby="encuesta-titulo" className={CARD}>
          <h2 id="encuesta-titulo" className={TITLE}>
            Encuesta
          </h2>
          <p>Calificación: {order.survey.rating} de 5</p>
          {order.survey.comment ? <p>«{order.survey.comment}»</p> : null}
        </section>
      ) : null}

      <section aria-labelledby="historial-titulo" className={CARD}>
        <h2 id="historial-titulo" className={TITLE}>
          Seguimiento
        </h2>
        <OrderTimeline events={order.events} />
      </section>

      {canCancel(order.status) ? (
        <CancelKitchenOrder
          order={order}
          onStale={(message) => setStale(message)}
        />
      ) : null}

      {back}
    </div>
  );
}
