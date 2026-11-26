import { MessageSquareText } from 'lucide-react';
import { WaitBadge } from '@/components/kitchen/wait-badge';
import { BLOCKED_TEXT, type Blocked } from '@/lib/dispatch/selection';
import { sinceFor, waitMinutes } from '@/lib/kitchen/board';
import type { Order } from '@/lib/orders/types';
import { cn } from '@/lib/utils';

/** Un pedido listo en la cola: casilla «Elegir pedido #N», punto, piso, indicación y espera (DP-02, DP-03). */
export function QueueOrderRow({
  order,
  now,
  checked,
  blocked,
  disabled,
  onToggle,
}: {
  order: Order;
  now: number;
  checked: boolean;
  blocked: Blocked;
  /** Mientras sale una ronda no se cambia la elección. */
  disabled: boolean;
  onToggle: () => void;
}) {
  const { delivery } = order;
  const where = [
    delivery.pointName,
    delivery.floor === null ? null : `Piso ${String(delivery.floor)}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const inactive = blocked !== null || disabled;
  const inputId = `pick-${order.id}`;
  return (
    <li
      className={cn(
        'rounded-xl border bg-card shadow-sm',
        checked && 'border-primary ring-2 ring-primary',
        inactive && !checked && 'opacity-70',
      )}
    >
      <label
        htmlFor={inputId}
        className={cn(
          'grid min-h-12 grid-cols-[auto_minmax(0,1fr)] items-start gap-3 p-4',
          inactive ? 'cursor-not-allowed' : 'cursor-pointer',
        )}
      >
        <input
          id={inputId}
          type="checkbox"
          className="mt-1 size-6 accent-primary"
          checked={checked}
          disabled={inactive && !checked}
          aria-label={`Elegir pedido #${String(order.number)}`}
          aria-describedby={blocked ? `${inputId}-why` : undefined}
          onChange={onToggle}
        />
        <span className="grid gap-1">
          <span className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-display text-xl font-semibold">
              Pedido #{order.number}
            </span>
            <WaitBadge
              status="listo"
              minutes={waitMinutes(sinceFor(order), now)}
            />
          </span>
          <span className="text-base">{where}</span>
          {delivery.deliveryNote ? (
            <span className="flex items-start gap-2 text-sm text-muted-foreground">
              <MessageSquareText
                className="mt-0.5 size-4 shrink-0"
                aria-hidden
              />
              {delivery.deliveryNote}
            </span>
          ) : null}
          {blocked ? (
            <span
              id={`${inputId}-why`}
              className="text-sm font-medium text-muted-foreground"
            >
              {BLOCKED_TEXT[blocked]}
            </span>
          ) : null}
        </span>
      </label>
    </li>
  );
}
