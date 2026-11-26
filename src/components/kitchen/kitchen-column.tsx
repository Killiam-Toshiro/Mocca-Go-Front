'use client';

import type { UseQueryResult } from '@tanstack/react-query';
import { useState } from 'react';
import { KitchenCard } from '@/components/kitchen/kitchen-card';
import { ReadyCard } from '@/components/kitchen/ready-card';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { describeApiError } from '@/lib/api/errors';
import {
  COLUMN_TITLE,
  READY_VISIBLE,
  visibleReady,
  type KitchenStatus,
} from '@/lib/kitchen/board';
import type { Order, OrderPage } from '@/lib/orders/types';
import { cn } from '@/lib/utils';

const EMPTY: Record<KitchenStatus, string> = {
  recibido: 'No hay pedidos por preparar.',
  en_preparacion: 'No hay pedidos en preparación.',
  listo: 'No hay pedidos listos esperando al repartidor.',
};

/** Una cola del tablero: Por preparar, En preparación o Listos. */
export function KitchenColumn({
  status,
  query,
  now,
  focusId,
  onActed,
  onStale,
  className,
}: {
  status: KitchenStatus;
  query: UseQueryResult<OrderPage>;
  now: number;
  focusId: string | null;
  onActed: (order: Order) => void;
  onStale: (order: Order, message: string) => void;
  className?: string;
}) {
  const [expanded, setExpanded] = useState(false);
  const orders = query.data?.data ?? [];
  const total = query.data?.total ?? 0;
  const shown = status === 'listo' ? visibleReady(orders, expanded) : orders;

  return (
    <section
      aria-labelledby={`column-${status}`}
      className={cn('grid content-start gap-3', className)}
    >
      <h2
        id={`column-${status}`}
        className="flex items-center gap-2 font-display text-xl font-semibold"
      >
        {COLUMN_TITLE[status]}
        {query.data ? (
          <span
            className="rounded-full bg-secondary px-2.5 py-0.5 text-sm text-secondary-foreground tabular-nums"
            aria-label={`${String(total)} ${total === 1 ? 'pedido' : 'pedidos'}`}
          >
            {total}
          </span>
        ) : null}
      </h2>

      <div className="grid content-start gap-3 rounded-2xl border bg-muted/40 p-3 lg:max-h-[calc(100vh-13rem)] lg:min-h-48 lg:overflow-y-auto">
        {query.isPending ? (
          <div
            aria-busy="true"
            aria-label="Cargando pedidos"
            className="grid gap-3"
          >
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        ) : query.isError && !query.data ? (
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
        ) : orders.length === 0 ? (
          <p className="text-muted-foreground">{EMPTY[status]}</p>
        ) : (
          <>
            <ul className="grid gap-3">
              {shown.map((order) =>
                status === 'listo' ? (
                  <ReadyCard
                    key={order.id}
                    order={order}
                    now={now}
                    focus={focusId === order.id}
                  />
                ) : (
                  <KitchenCard
                    key={order.id}
                    order={order}
                    status={status}
                    now={now}
                    focus={focusId === order.id}
                    onActed={onActed}
                    onStale={onStale}
                  />
                ),
              )}
            </ul>
            {status === 'listo' && orders.length > READY_VISIBLE ? (
              <Button
                type="button"
                variant="outline"
                className="h-12 justify-self-start text-base"
                aria-expanded={expanded}
                onClick={() => setExpanded((open) => !open)}
              >
                {expanded
                  ? 'Ver menos'
                  : `Ver los ${String(orders.length)} listos`}
              </Button>
            ) : null}
            {total > orders.length ? (
              <p className="text-sm text-muted-foreground">
                Mostrando los {orders.length} más antiguos de {total}.
              </p>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
