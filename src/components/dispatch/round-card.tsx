import { AlarmClock, Clock } from 'lucide-react';
import {
  clock,
  isOverdue,
  overdueLabel,
  overdueMinutes,
  progressLabel,
  roundProgress,
  type Progress,
} from '@/lib/dispatch/rounds';
import type { Round } from '@/lib/dispatch/types';
import type { Order } from '@/lib/orders/types';
import { RoundOrderCard } from './round-order-card';

/** Una ronda activa: zona, salida, llegada estimada, avance y sus pedidos (DP-05). */
export function RoundCard({
  round,
  now,
  onClosed,
  onStale,
}: {
  round: Round;
  now: number;
  onClosed: (order: Order, finished: Progress | null) => void;
  onStale: (order: Order, message: string) => void;
}) {
  const progress = roundProgress(round);
  const overdue = isOverdue(round, now);
  return (
    <section
      aria-labelledby={`round-${round.id}`}
      className="grid gap-3 rounded-2xl border bg-muted/40 p-3"
    >
      <header className="grid gap-1 px-1">
        <h2
          id={`round-${round.id}`}
          className="font-display text-xl font-semibold"
        >
          Ronda · {round.zone.name}
        </h2>
        <p className="text-sm text-muted-foreground">
          Salida {clock(round.startedAt)} · Llegada estimada{' '}
          {clock(round.etaAt)}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm font-medium">
          <span>{progressLabel(progress)}</span>
          {overdue ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive bg-card px-2.5 py-1 font-semibold text-destructive">
              <AlarmClock className="size-4" aria-hidden />
              {overdueLabel(overdueMinutes(round.etaAt, now))}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 text-muted-foreground">
              <Clock className="size-4" aria-hidden />
              En camino
            </span>
          )}
        </div>
      </header>
      <ul className="grid gap-3">
        {round.orders.map((order) => (
          <RoundOrderCard
            key={order.id}
            order={order}
            onClosed={onClosed}
            onStale={onStale}
          />
        ))}
      </ul>
    </section>
  );
}
