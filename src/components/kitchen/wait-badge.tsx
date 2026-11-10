import { AlarmClock, Clock } from 'lucide-react';
import {
  durationLabel,
  isLongWait,
  waitLabel,
  type KitchenStatus,
} from '@/lib/kitchen/board';
import { cn } from '@/lib/utils';

/** Cuánto lleva el pedido en su estado; pasado el umbral se marca con texto e ícono (D-062). */
export function WaitBadge({
  status,
  minutes,
  className,
}: {
  status: KitchenStatus;
  minutes: number;
  className?: string;
}) {
  const long = isLongWait(status, minutes);
  const Icon = long ? AlarmClock : Clock;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-semibold whitespace-nowrap',
        long
          ? 'border border-destructive bg-card text-destructive'
          : 'text-muted-foreground',
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
      {long ? `Lleva ${durationLabel(minutes)}` : waitLabel(minutes)}
    </span>
  );
}
