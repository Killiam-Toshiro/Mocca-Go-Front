import { AlarmClock } from 'lucide-react';
import Link from 'next/link';
import {
  clock,
  isOverdue,
  overdueMinutes,
  progressLabel,
  roundProgress,
} from '@/lib/dispatch/rounds';
import type { Round } from '@/lib/dispatch/types';
import { durationLabel } from '@/lib/kitchen/board';

/** Una ronda en la lista: zona, repartidor, avance y «Atrasada N min» si venció (D-123). */
export function StaffRoundRow({
  round,
  base,
  now,
}: {
  round: Round;
  base: string;
  now: number;
}) {
  const progress = roundProgress(round);
  const overdue = isOverdue(round, now);
  return (
    <li>
      <Link
        href={`${base}/rondas/${round.id}`}
        className="grid gap-2 rounded-xl border bg-card p-4 shadow-sm transition-colors outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-display text-lg font-semibold">
            Ronda · {round.zone.name}
          </span>
          <span className="rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold text-secondary-foreground">
            {round.status === 'activa' ? 'Activa' : 'Finalizada'}
          </span>
        </div>
        <p className="text-sm">{round.courier.fullName ?? 'Sin repartidor'}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>
            Salida {clock(round.startedAt)} · {progressLabel(progress)}
          </span>
          {overdue ? (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-destructive bg-card px-2.5 py-1 font-semibold text-destructive">
              <AlarmClock className="size-4" aria-hidden />
              Atrasada {durationLabel(overdueMinutes(round.etaAt, now))}
            </span>
          ) : null}
        </div>
      </Link>
    </li>
  );
}
