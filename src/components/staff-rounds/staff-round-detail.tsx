'use client';

import { AlarmClock } from 'lucide-react';
import Link from 'next/link';
import { ContactLinks } from '@/components/dispatch/contact-links';
import { StatusBadge } from '@/components/orders/status-badge';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { describeApiError, isApiError } from '@/lib/api/errors';
import { telHref } from '@/lib/dispatch/contact';
import {
  clock,
  isOverdue,
  itemsSummary,
  overdueMinutes,
  progressLabel,
  roundProgress,
} from '@/lib/dispatch/rounds';
import { durationLabel } from '@/lib/kitchen/board';
import { useNow } from '@/lib/kitchen/use-now';
import { deliveryLine } from '@/lib/staff-orders/format';
import { useStaffRound } from '@/lib/staff-rounds/use-staff-rounds';

/** Detalle de una ronda: repartidor, horarios, avance y sus pedidos enlazados (D-123). */
export function StaffRoundDetail({ id, base }: { id: string; base: string }) {
  const query = useStaffRound(id);
  const now = useNow();
  const round = query.data;
  const back = (
    <Button asChild variant="outline" className="justify-self-start">
      <Link href={`${base}/rondas`}>Ver rondas</Link>
    </Button>
  );

  if (query.isPending) {
    return (
      <div
        aria-busy="true"
        aria-label="Cargando la ronda"
        className="mx-auto grid w-full max-w-2xl gap-4"
      >
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }
  if (query.isError || !round) {
    const notFound =
      isApiError(query.error) &&
      (query.error.status === 404 || query.error.status === 400);
    return (
      <div className="mx-auto grid w-full max-w-2xl justify-items-start gap-3">
        <h1 className="font-display text-3xl font-semibold">Ronda</h1>
        {notFound ? (
          <p>No encontramos esta ronda.</p>
        ) : (
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
        )}
        {back}
      </div>
    );
  }

  const progress = roundProgress(round);
  const overdue = isOverdue(round, now);
  const { courier } = round;
  const tel = courier.phone ? telHref(courier.phone) : null;
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <header className="grid gap-1">
        <h1 className="font-display text-3xl font-semibold">
          Ronda · {round.zone.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          {round.status === 'activa' ? 'Activa' : 'Finalizada'} · Salida{' '}
          {clock(round.startedAt)} · Llegada estimada {clock(round.etaAt)}
          {round.finishedAt ? ` · Terminó ${clock(round.finishedAt)}` : ''}
        </p>
        <p className="text-sm font-medium">{progressLabel(progress)}</p>
        {overdue ? (
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-destructive bg-card px-2.5 py-1 text-sm font-semibold text-destructive">
            <AlarmClock className="size-4" aria-hidden />
            Atrasada {durationLabel(overdueMinutes(round.etaAt, now))}
          </span>
        ) : null}
      </header>

      <section
        aria-labelledby="repartidor-titulo"
        className="grid gap-3 rounded-xl border bg-card p-4"
      >
        <h2
          id="repartidor-titulo"
          className="font-display text-xl font-semibold"
        >
          Repartidor
        </h2>
        {courier.fullName ? (
          <p className="font-semibold">{courier.fullName}</p>
        ) : (
          <p className="text-muted-foreground">Sin datos del repartidor.</p>
        )}
        {courier.phone ? (
          tel ? (
            <a
              href={tel}
              className="inline-flex min-h-12 w-fit items-center rounded-lg border bg-card px-3 text-base font-medium text-brand-strong outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              Llamar {courier.phone}
            </a>
          ) : (
            <p>{courier.phone}</p>
          )
        ) : null}
      </section>

      <section aria-labelledby="pedidos-titulo" className="grid gap-3">
        <h2 id="pedidos-titulo" className="font-display text-xl font-semibold">
          Pedidos de la ronda
        </h2>
        <ul className="grid gap-3">
          {round.orders.map((order) => (
            <li
              key={order.id}
              className="grid gap-2 rounded-xl border bg-card p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Link
                  href={`${base}/pedidos/${order.id}`}
                  className="font-display text-lg font-semibold underline-offset-4 hover:underline"
                >
                  Pedido #{order.number}
                </Link>
                <StatusBadge status={order.status} />
              </div>
              <p className="text-sm text-muted-foreground">
                {itemsSummary(order)} · {deliveryLine(order)}
              </p>
              <ContactLinks
                name={order.customer.name}
                phone={order.customer.phone}
              />
              {order.failureReason ? (
                <p className="text-sm text-destructive">
                  No entregado: {order.failureReason}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      </section>

      {back}
    </div>
  );
}
