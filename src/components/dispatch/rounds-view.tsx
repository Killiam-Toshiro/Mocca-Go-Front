'use client';

import Link from 'next/link';
import { useState } from 'react';
import { LiveBadge } from '@/components/orders/live-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { describeApiError } from '@/lib/api/errors';
import { finishedText, type Progress } from '@/lib/dispatch/rounds';
import { useActiveRounds } from '@/lib/dispatch/use-dispatch-queue';
import { useNow } from '@/lib/kitchen/use-now';
import type { Order } from '@/lib/orders/types';
import { RoundCard } from './round-card';

/** «Mis rondas»: lo que el repartidor lleva en la calle y el cierre de cada pedido (D-DP-05 a DP-08). */
export function RoundsView() {
  const query = useActiveRounds();
  const now = useNow();
  const [notice, setNotice] = useState<string | null>(null);
  const [finished, setFinished] = useState<string | null>(null);
  const [acted, setActed] = useState('');

  function onClosed(order: Order, done: Progress | null) {
    setActed(
      `Pedido #${String(order.number)}: ${order.status === 'entregado' ? 'entregado' : 'no entregado'}`,
    );
    if (done) setFinished(finishedText(done));
  }

  const rounds = query.data?.data ?? [];

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="font-display text-3xl font-semibold">Mis rondas</h1>
        <LiveBadge />
      </div>

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {acted}
      </p>
      <p
        role="status"
        aria-live="polite"
        className={finished ? 'font-medium' : 'sr-only'}
      >
        {finished}
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
            className="min-h-12"
            onClick={() => setNotice(null)}
          >
            Entendido
          </Button>
        </Alert>
      ) : null}

      {query.isPending ? (
        <div
          aria-busy="true"
          aria-label="Cargando rondas"
          className="grid gap-3"
        >
          <Skeleton className="h-40 w-full" />
          <Skeleton className="h-40 w-full" />
        </div>
      ) : query.isError && !query.data ? (
        <Alert variant="destructive" className="grid gap-2">
          {describeApiError(query.error).map((line) => (
            <p key={line}>{line}</p>
          ))}
          <Button
            type="button"
            variant="outline"
            className="min-h-12 justify-self-start"
            onClick={() => void query.refetch()}
          >
            Reintentar
          </Button>
        </Alert>
      ) : rounds.length === 0 ? (
        <div className="grid gap-3 rounded-xl border bg-card p-4">
          <p className="text-muted-foreground">No tienes rondas activas.</p>
          <Link
            href="/repartidor/cola"
            className="inline-flex min-h-12 items-center justify-self-start rounded-lg border px-4 font-medium text-brand-strong outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ir a la cola de despacho
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {rounds.map((round) => (
            <RoundCard
              key={round.id}
              round={round}
              now={now}
              onClosed={onClosed}
              onStale={(order, message) =>
                setNotice(`Pedido #${String(order.number)}: ${message}`)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
