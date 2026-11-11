'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LiveBadge } from '@/components/orders/live-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { describeApiError } from '@/lib/api/errors';
import { useCreateRound } from '@/lib/dispatch/use-create-round';
import {
  useActiveRounds,
  useDispatchQueue,
} from '@/lib/dispatch/use-dispatch-queue';
import { useNewReadyOrders } from '@/lib/dispatch/use-new-ready';
import {
  MAX_ACTIVE_ROUNDS,
  NO_SELECTION,
  prune,
  toggle,
  type Pick,
  type Selection,
} from '@/lib/dispatch/selection';
import { useTitleCount } from '@/lib/kitchen/use-new-orders';
import { useNow } from '@/lib/kitchen/use-now';
import { RoundBar } from './round-bar';
import { ZoneCard } from './zone-card';

/** «Cola de despacho»: pedidos listos por zona y salida a repartir (DP-01 a DP-04, DP-10). */
export function QueueView() {
  const router = useRouter();
  const query = useDispatchQueue();
  const rounds = useActiveRounds();
  const now = useNow();
  const { announcement, unseen } = useNewReadyOrders();
  useTitleCount(unseen);
  const [selection, setSelection] = useState<Selection>(NO_SELECTION);
  const [notice, setNotice] = useState<string | null>(null);

  const create = useCreateRound({
    onDone: () => {
      setSelection(NO_SELECTION);
      router.push('/repartidor/rondas');
    },
    onFail: (error) => {
      setNotice(error.messages.join(' '));
    },
  });

  // La elección se depura contra la cola: un pedido que otro repartidor tomó se quita y se avisa.
  const { selection: current, removed } = prune(selection, query.data);
  const zones = query.data?.zones ?? [];
  const limitReached = (rounds.data?.total ?? 0) >= MAX_ACTIVE_ROUNDS;

  function onToggle(zoneId: string, pick: Pick) {
    setNotice(null);
    setSelection(toggle(current, zoneId, pick));
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h1 className="font-display text-3xl font-semibold">
          Cola de despacho
        </h1>
        <LiveBadge />
      </div>

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {announcement}
      </p>

      {removed.length > 0 ? (
        <Alert variant="destructive">
          {removed.length === 1
            ? `El pedido #${String(removed[0]?.number)} ya no está listo y se quitó de tu elección.`
            : `Los pedidos ${removed.map((p) => `#${String(p.number)}`).join(', ')} ya no están listos y se quitaron de tu elección.`}
        </Alert>
      ) : null}

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
          aria-label="Cargando la cola"
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
      ) : zones.length === 0 ? (
        <p className="rounded-xl border bg-card p-4 text-muted-foreground">
          No hay pedidos listos para repartir.
        </p>
      ) : (
        <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-2">
          {zones.map((zone) => (
            <ZoneCard
              key={zone.zoneId}
              zone={zone}
              suggested={zone.zoneId === query.data?.suggestedZoneId}
              now={now}
              selection={current}
              disabled={create.pending}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}

      <RoundBar
        picked={current.picks.length}
        anyReady={zones.length > 0}
        limitReached={limitReached}
        pending={create.pending}
        onSuggested={() => void create.run()}
        onChosen={() => void create.run(current.picks.map((p) => p.id))}
        onClear={() => setSelection(NO_SELECTION)}
      />
    </div>
  );
}
