import { formatOrderDate } from '@/lib/orders/format';
import { statusInfo } from '@/lib/orders/status';
import type { Order } from '@/lib/orders/types';
import { cn } from '@/lib/utils';

/** Historial de estados (`events`); el estado actual va resaltado y marcado para lectores. */
export function OrderTimeline({ events }: { events: Order['events'] }) {
  return (
    <ol aria-label="Historial del pedido" className="grid gap-3">
      {events.map((event, index) => {
        const current = index === events.length - 1;
        return (
          <li
            key={`${event.status}-${event.at}`}
            aria-current={current ? 'step' : undefined}
            className="flex items-start gap-3"
          >
            <span
              aria-hidden
              className={cn(
                'mt-1.5 size-3 shrink-0 rounded-full border-2',
                current
                  ? 'border-primary bg-primary'
                  : 'border-muted-foreground',
              )}
            />
            <div className="grid">
              <span
                className={cn(
                  current ? 'font-semibold' : 'text-muted-foreground',
                )}
              >
                {statusInfo(event.status).label}
              </span>
              <span className="text-sm text-muted-foreground">
                {formatOrderDate(event.at)}
              </span>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
