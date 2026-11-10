'use client';

import Link from 'next/link';
import { LoaderCircle } from 'lucide-react';
import { LiveBadge } from '@/components/orders/live-badge';
import { OrderRow } from '@/components/orders/order-row';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { describeApiError } from '@/lib/api/errors';
import { useOrders } from '@/lib/orders/use-orders';

/** «Mis pedidos»: los del cliente, más reciente primero, de 10 en 10 (D-043). */
export function OrdersView() {
  const query = useOrders();
  const orders = query.data?.pages.flatMap((page) => page.data) ?? [];

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="font-display text-3xl font-semibold">Mis pedidos</h1>
        <LiveBadge />
      </div>

      {query.isPending ? (
        <div
          aria-busy="true"
          aria-label="Cargando tus pedidos"
          className="grid gap-3"
        >
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : query.isError ? (
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
        <div className="grid justify-items-start gap-3">
          <p className="text-muted-foreground">Aún no has hecho pedidos.</p>
          <Button asChild>
            <Link href="/cliente/menu">Ver el menú</Link>
          </Button>
        </div>
      ) : (
        <>
          <ul className="grid gap-3">
            {orders.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </ul>
          {query.hasNextPage ? (
            <Button
              type="button"
              variant="outline"
              className="justify-self-center"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              {query.isFetchingNextPage ? (
                <>
                  <LoaderCircle className="animate-spin" aria-hidden />
                  Cargando…
                </>
              ) : (
                'Ver más'
              )}
            </Button>
          ) : null}
        </>
      )}
    </div>
  );
}
