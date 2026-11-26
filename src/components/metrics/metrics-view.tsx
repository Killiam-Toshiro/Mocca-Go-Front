'use client';

import { RefreshCw } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMemo } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ExportControls } from '@/components/export/export-controls';
import { Skeleton } from '@/components/ui/skeleton';
import { describeApiError, isApiError } from '@/lib/api/errors';
import { exportMetrics } from '@/lib/export/export-metrics';
import { useExportJob } from '@/lib/export/use-export-job';
import { formatClock, formatCount, formatDayLong } from '@/lib/metrics/format';
import {
  metricsQuery,
  parseMetricsFilters,
  todayBogota,
  type Period,
} from '@/lib/metrics/period';
import { useMetrics } from '@/lib/metrics/use-metrics';
import { useAdminZones } from '@/lib/zones/use-admin-zones';
import { MetricsFilters } from './metrics-filters';
import {
  DeliverySection,
  MarginSection,
  OutcomesSection,
  RetentionSection,
  SalesSection,
  SatisfactionSection,
} from './sections';

/** Panel de métricas del admin: filtros en la URL, seis secciones y gráficas (D-129, D-130). */
export function MetricsView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const today = useMemo(() => todayBogota(), []);
  const filters = parseMetricsFilters(params, today);
  const zones = useAdminZones();
  const query = useMetrics(filters, filters.error === null);
  const data = query.data;
  const job = useExportJob();
  const zoneName =
    zones.data?.find((z) => z.id === filters.zoneId)?.name ?? null;

  function go(next: { period: Period; zoneId: string | null }) {
    router.replace(
      `${pathname}?${metricsQuery({ ...next.period, zoneId: next.zoneId }).toString()}`,
      {
        scroll: false,
      },
    );
  }

  const zoneMissing =
    query.isError &&
    filters.zoneId !== null &&
    isApiError(query.error) &&
    query.error.status === 404;

  const total = data
    ? data.outcomes.entregado +
      data.outcomes.no_entregado +
      data.outcomes.cancelado +
      data.outcomes.enCurso
    : 0;
  const empty = total === 0;
  const surveysHref = `/admin/encuestas?from=${filters.from}&to=${filters.to}`;

  return (
    <div className="mx-auto grid w-full max-w-5xl gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold">Métricas</h1>
        <p className="text-muted-foreground">
          Cómo va el negocio en los pedidos creados en el periodo (hora de
          Colombia).
        </p>
      </header>

      <MetricsFilters
        key={`${filters.from}|${filters.to}`}
        period={filters}
        zoneId={filters.zoneId}
        today={today}
        zones={zones.data ?? []}
        onChange={go}
      />

      {filters.error ? (
        <Alert variant="destructive" role="alert">
          {filters.error} Cambia las fechas para ver las métricas.
        </Alert>
      ) : zoneMissing ? (
        <Alert variant="destructive" role="alert" className="grid gap-3">
          <p>{describeApiError(query.error).join(' ')}</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-12 justify-self-start"
            onClick={() => go({ period: filters, zoneId: null })}
          >
            Entendido
          </Button>
        </Alert>
      ) : query.isPending ? (
        <div
          role="status"
          aria-label="Cargando métricas"
          className="grid gap-4"
        >
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : query.isError && !data ? (
        <Alert variant="destructive" role="alert" className="grid gap-3">
          <p>{describeApiError(query.error).join(' ')}</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-12 justify-self-start"
            onClick={() => void query.refetch()}
          >
            Reintentar
          </Button>
        </Alert>
      ) : data ? (
        <div
          aria-busy={query.isPlaceholderData || query.isFetching}
          className={`grid gap-6 ${query.isPlaceholderData ? 'opacity-60' : ''}`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p
              role="status"
              aria-live="polite"
              className="text-sm text-muted-foreground"
            >
              {query.isPlaceholderData
                ? 'Actualizando…'
                : `Del ${formatDayLong(data.period.from)} al ${formatDayLong(data.period.to)} · ${formatCount(data.period.days)} ${data.period.days === 1 ? 'día' : 'días'} · Consultado a las ${formatClock(query.dataUpdatedAt)}`}
            </p>
            <Button
              type="button"
              variant="outline"
              className="min-h-12"
              disabled={query.isFetching}
              onClick={() => void query.refetch()}
            >
              <RefreshCw aria-hidden />
              Actualizar
            </Button>
          </div>
          <ExportControls
            state={job.state}
            disabled={query.isPlaceholderData}
            onDismiss={job.reset}
            onStart={() =>
              void job.run(() =>
                exportMetrics(data, {
                  zoneName,
                  consultedAt: query.dataUpdatedAt,
                }),
              )
            }
          />
          {query.isError ? (
            <Alert variant="destructive" role="alert">
              {describeApiError(query.error).join(' ')} Se muestran las cifras
              anteriores.
            </Alert>
          ) : null}
          <SalesSection data={data.sales} empty={empty} />
          <MarginSection data={data.margin} empty={empty} />
          <DeliverySection data={data.delivery} />
          <SatisfactionSection
            data={data.satisfaction}
            surveysHref={surveysHref}
          />
          <RetentionSection data={data.retention} />
          <OutcomesSection data={data.outcomes} empty={empty} />
        </div>
      ) : null}
    </div>
  );
}
