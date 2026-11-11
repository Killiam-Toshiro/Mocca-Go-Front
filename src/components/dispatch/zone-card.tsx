import { Star } from 'lucide-react';
import {
  blockedReason,
  isPicked,
  type Pick,
  type Selection,
} from '@/lib/dispatch/selection';
import type { ZoneQueue } from '@/lib/dispatch/types';
import { QueueOrderRow } from './queue-order-row';

/** Una zona con sus pedidos listos; la sugerida (la del más antiguo) va marcada con texto e ícono. */
export function ZoneCard({
  zone,
  suggested,
  now,
  selection,
  disabled,
  onToggle,
}: {
  zone: ZoneQueue;
  suggested: boolean;
  now: number;
  selection: Selection;
  disabled: boolean;
  onToggle: (zoneId: string, pick: Pick) => void;
}) {
  const count = zone.orders.length;
  return (
    <section
      aria-labelledby={`zone-${zone.zoneId}`}
      className="grid content-start gap-3 rounded-2xl border bg-muted/40 p-3"
    >
      <header className="grid gap-1 px-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id={`zone-${zone.zoneId}`}
            className="font-display text-xl font-semibold"
          >
            {zone.zoneName}
          </h2>
          <span className="text-sm font-medium text-muted-foreground">
            {count} {count === 1 ? 'pedido listo' : 'pedidos listos'}
          </span>
        </div>
        {suggested ? (
          <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand-strong">
            <Star className="size-4" aria-hidden />
            Sugerida: lleva el pedido más antiguo
          </p>
        ) : null}
      </header>
      <ul className="grid gap-3">
        {zone.orders.map((order) => (
          <QueueOrderRow
            key={order.id}
            order={order}
            now={now}
            checked={isPicked(selection, order.id)}
            blocked={blockedReason(selection, zone.zoneId, order.id)}
            disabled={disabled}
            onToggle={() =>
              onToggle(zone.zoneId, { id: order.id, number: order.number })
            }
          />
        ))}
      </ul>
    </section>
  );
}
