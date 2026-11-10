'use client';

import { useState } from 'react';
import { KitchenColumn } from '@/components/kitchen/kitchen-column';
import { LiveBadge } from '@/components/orders/live-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  COLUMN_TITLE,
  KITCHEN_STATUSES,
  type KitchenStatus,
} from '@/lib/kitchen/board';
import {
  useNewKitchenOrders,
  useTitleCount,
} from '@/lib/kitchen/use-new-orders';
import { useNow } from '@/lib/kitchen/use-now';
import { useKitchenBoard } from '@/lib/kitchen/use-kitchen-queue';
import { statusInfo } from '@/lib/orders/status';
import type { Order } from '@/lib/orders/types';
import { cn } from '@/lib/utils';

/** Tablero de cocina en vivo para operador y admin (D-055 a D-064). */
export function KitchenView() {
  const board = useKitchenBoard();
  const now = useNow();
  const { announcement, unseen } = useNewKitchenOrders();
  useTitleCount(unseen);
  const [tab, setTab] = useState<KitchenStatus>('recibido');
  const [notice, setNotice] = useState<string | null>(null);
  const [acted, setActed] = useState<{ id: string; text: string } | null>(null);

  function onActed(order: Order) {
    const label = statusInfo(order.status).label;
    setActed({
      id: order.id,
      text: `Pedido #${String(order.number)}: ${label}`,
    });
  }

  function onStale(order: Order, message: string) {
    setNotice(`Pedido #${String(order.number)}: ${message}`);
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="font-display text-3xl font-semibold">Cocina</h1>
        <LiveBadge />
      </div>

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {acted?.text}
      </p>

      {notice ? (
        <Alert
          variant="destructive"
          className="flex items-center justify-between gap-3"
        >
          <p>{notice}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setNotice(null)}
          >
            Entendido
          </Button>
        </Alert>
      ) : null}

      <div
        role="group"
        aria-label="Columna que se muestra"
        className="grid grid-cols-3 gap-1 lg:hidden"
      >
        {KITCHEN_STATUSES.map((status) => (
          <button
            key={status}
            type="button"
            aria-pressed={tab === status}
            onClick={() => setTab(status)}
            className={cn(
              'flex min-h-12 flex-col items-center justify-center rounded-lg border px-1 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring',
              tab === status
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-card-foreground',
            )}
          >
            {COLUMN_TITLE[status]}
            <span className="tabular-nums">
              {board[status].data ? board[status].data.total : '–'}
            </span>
          </button>
        ))}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-3">
        {KITCHEN_STATUSES.map((status) => (
          <KitchenColumn
            key={status}
            status={status}
            query={board[status]}
            now={now}
            focusId={acted?.id ?? null}
            onActed={onActed}
            onStale={onStale}
            className={tab === status ? undefined : 'hidden lg:grid'}
          />
        ))}
      </div>
    </div>
  );
}
