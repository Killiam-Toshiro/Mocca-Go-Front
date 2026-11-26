'use client';

import { CircleCheck, CircleX, MessageSquareText } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import type { DispatchError } from '@/lib/dispatch/errors';
import { itemsSummary, type Progress } from '@/lib/dispatch/rounds';
import { useCloseOrder, type CloseKind } from '@/lib/dispatch/use-close-order';
import type { Order } from '@/lib/orders/types';
import { ContactLinks } from './contact-links';
import { DeliverConfirm } from './deliver-confirm';
import { FailForm } from './fail-form';

type Mode = 'idle' | 'deliver' | 'fail';

/** Un pedido dentro de una ronda: datos para entregarlo y las acciones de cierre (DP-06, DP-07, DP-08). */
export function RoundOrderCard({
  order,
  onClosed,
  onStale,
}: {
  order: Order;
  onClosed: (order: Order, finished: Progress | null) => void;
  /** El pedido cambió o ya no es del repartidor: el aviso vive en la pantalla (D-058). */
  onStale: (order: Order, message: string) => void;
}) {
  const [mode, setMode] = useState<Mode>('idle');
  const [failure, setFailure] = useState<{
    error: DispatchError;
    retryable: boolean;
  } | null>(null);
  const [last, setLast] = useState<{
    kind: CloseKind;
    reason?: string;
  } | null>(null);
  const ref = useRef<HTMLElement>(null);
  const previous = useRef(order.status);

  const close = useCloseOrder({
    onDone: (done, finished) => {
      setMode('idle');
      setFailure(null);
      onClosed(done, finished);
    },
    onFail: (error, retryable) => {
      if (error.kind === 'conflict' || error.kind === 'missing') {
        setMode('idle');
        setFailure(null);
        onStale(order, error.messages.join(' '));
        return;
      }
      setFailure({ error, retryable });
    },
  });

  // Al cerrarse el pedido el foco se queda en su tarjeta (no se pierde con los botones).
  useEffect(() => {
    if (previous.current === 'en_camino' && order.status !== 'en_camino')
      ref.current?.focus();
    previous.current = order.status;
  }, [order.status]);

  function run(kind: CloseKind, reason?: string) {
    setLast({ kind, reason });
    setFailure(null);
    void close.run(kind, order.id, reason);
  }

  const { delivery } = order;
  const where = [
    delivery.zoneName,
    delivery.pointName,
    delivery.floor === null ? null : `Piso ${String(delivery.floor)}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const open = order.status === 'en_camino';
  const validation =
    failure?.error.kind === 'validation'
      ? failure.error.messages.join(' ')
      : undefined;
  const banner =
    failure && failure.error.kind !== 'validation' ? failure : null;

  return (
    <li>
      <article
        ref={ref}
        tabIndex={-1}
        aria-labelledby={`round-order-${order.id}`}
        className={`grid gap-3 rounded-xl border p-4 shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-ring ${open ? 'bg-card' : 'bg-muted/50 text-muted-foreground'}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3
            id={`round-order-${order.id}`}
            className="font-display text-2xl font-semibold"
          >
            Pedido #{order.number}
          </h3>
          {order.status === 'entregado' ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-foreground">
              <CircleCheck className="size-5" aria-hidden />
              Entregado
            </span>
          ) : order.status === 'no_entregado' ? (
            <span className="inline-flex items-center gap-1.5 font-semibold text-destructive">
              <CircleX className="size-5" aria-hidden />
              No entregado
            </span>
          ) : null}
        </div>

        <p className="text-lg font-medium">{where}</p>
        {delivery.deliveryNote ? (
          <p className="flex items-start gap-2 rounded-lg bg-secondary px-3 py-2 text-secondary-foreground">
            <MessageSquareText className="mt-0.5 size-4 shrink-0" aria-hidden />
            <span>
              <strong>Indicación:</strong> {delivery.deliveryNote}
            </span>
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">{itemsSummary(order)}</p>

        {order.status === 'no_entregado' && order.failureReason ? (
          <p className="text-sm">
            <strong>Motivo:</strong> {order.failureReason}
          </p>
        ) : null}

        {open ? (
          <ContactLinks
            name={order.customer.name}
            phone={order.customer.phone}
          />
        ) : null}

        {banner ? (
          <Alert variant="destructive" className="grid gap-2">
            <p>{banner.error.messages.join(' ')}</p>
            {banner.retryable && last ? (
              <Button
                type="button"
                variant="outline"
                className="min-h-12 justify-self-start"
                onClick={() => run(last.kind, last.reason)}
              >
                Reintentar
              </Button>
            ) : null}
          </Alert>
        ) : null}

        {open && mode === 'idle' ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="min-h-12 min-w-36 text-base"
              aria-label={`Entregado #${String(order.number)}`}
              onClick={() => setMode('deliver')}
            >
              Entregado
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-12 text-base"
              aria-label={`No entregado #${String(order.number)}`}
              onClick={() => setMode('fail')}
            >
              No entregado
            </Button>
          </div>
        ) : null}

        {open && mode === 'deliver' ? (
          <DeliverConfirm
            number={order.number}
            pending={close.pending}
            onConfirm={() => run('deliver')}
            onBack={() => {
              setMode('idle');
              setFailure(null);
            }}
          />
        ) : null}

        {open && mode === 'fail' ? (
          <FailForm
            number={order.number}
            pending={close.pending}
            serverError={validation}
            onSubmit={(reason) => run('fail', reason)}
            onBack={() => {
              setMode('idle');
              setFailure(null);
            }}
          />
        ) : null}
      </article>
    </li>
  );
}
