'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { ExportControls } from '@/components/export/export-controls';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { describeApiError } from '@/lib/api/errors';
import { exportSurveys } from '@/lib/export/export-surveys';
import { EXPORT_CAP } from '@/lib/export/fetch-all-surveys';
import { useExportJob } from '@/lib/export/use-export-job';
import { formatCount } from '@/lib/metrics/format';
import {
  RATING_FILTERS,
  SURVEYS_PAGE_SIZE,
  hasSurveyFilters,
  parseSurveyFilters,
  surveyParams,
} from '@/lib/surveys/filters';
import { useSurveys } from '@/lib/surveys/use-surveys';
import { SurveyRow } from './survey-row';

/** Respuestas de la encuesta con filtros y página en la URL (D-131). */
export function SurveysView() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const search = params.toString();
  const filters = parseSurveyFilters(params);
  /** La URL que ya pedimos pero Next aún no aplicó: dos cambios seguidos no se pisan. */
  const pending = useRef<string | null>(null);
  useEffect(() => {
    pending.current = null;
  }, [search]);
  const query = useSurveys(filters);
  const data = query.data;
  const filtered = hasSurveyFilters(filters);
  const job = useExportJob();

  function go(next: Partial<Omit<typeof filters, 'error'>>) {
    const base = parseSurveyFilters(
      new URLSearchParams(pending.current ?? search),
    );
    const merged = { ...base, page: 1, ...next };
    const q = surveyParams(merged).toString();
    pending.current = q;
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false });
  }

  const metricsHref =
    filters.from && filters.to && !filters.error
      ? `/admin/metricas?from=${filters.from}&to=${filters.to}`
      : '/admin/metricas';

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold">Encuestas</h1>
        <p className="text-muted-foreground">
          Lo que opinan los clientes de sus pedidos entregados, de la más
          reciente a la más antigua.
        </p>
      </header>

      <div className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm sm:grid-cols-3">
        <div className="grid gap-1.5">
          <Label htmlFor="surveys-rating">Calificación</Label>
          <Select
            id="surveys-rating"
            className="h-12"
            value={filters.rating ? String(filters.rating) : ''}
            onChange={(e) =>
              go({ rating: e.target.value ? Number(e.target.value) : null })
            }
          >
            <option value="">Todas</option>
            {[...RATING_FILTERS].reverse().map((n) => (
              <option key={n} value={n}>
                {n === 1 ? '1 estrella' : `${String(n)} estrellas`}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="surveys-from">Desde</Label>
          <Input
            id="surveys-from"
            type="date"
            className="h-12"
            value={filters.from ?? ''}
            aria-invalid={filters.error ? true : undefined}
            aria-describedby={filters.error ? 'surveys-error' : undefined}
            onChange={(e) => go({ from: e.target.value || null })}
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="surveys-to">Hasta</Label>
          <Input
            id="surveys-to"
            type="date"
            className="h-12"
            value={filters.to ?? ''}
            aria-invalid={filters.error ? true : undefined}
            aria-describedby={filters.error ? 'surveys-error' : undefined}
            onChange={(e) => go({ to: e.target.value || null })}
          />
        </div>
        {filters.error ? (
          <p
            id="surveys-error"
            role="alert"
            className="text-sm text-destructive sm:col-span-3"
          >
            {filters.error}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3 sm:col-span-3">
          {filtered ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-12"
              onClick={() => go({ rating: null, from: null, to: null })}
            >
              Quitar filtros
            </Button>
          ) : null}
          <Link
            href={metricsHref}
            className="inline-flex min-h-12 items-center rounded-md text-sm font-medium text-brand-strong underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
          >
            Ver las métricas del mismo periodo
          </Link>
        </div>
      </div>

      {data && data.total > 0 && !filters.error ? (
        <ExportControls
          state={job.state}
          cancellable
          onCancel={job.cancel}
          onDismiss={job.reset}
          onStart={() =>
            void job.run(({ signal, onProgress }) =>
              exportSurveys(filters, { signal, onProgress }),
            )
          }
          {...(data.total > EXPORT_CAP
            ? {
                note: `Hay ${formatCount(data.total)} respuestas: el archivo trae las ${formatCount(EXPORT_CAP)} más recientes.`,
              }
            : {})}
        />
      ) : null}

      {filters.error ? null : query.isPending ? (
        <div
          role="status"
          aria-label="Cargando encuestas"
          className="grid gap-3"
        >
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
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
        <>
          <p
            role="status"
            aria-live="polite"
            className="text-sm text-muted-foreground"
          >
            {query.isPlaceholderData
              ? 'Buscando…'
              : data.total === 1
                ? '1 respuesta'
                : `${formatCount(data.total)} respuestas`}
          </p>
          {data.data.length === 0 ? (
            <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">
              {filtered
                ? 'No hay respuestas con estos filtros.'
                : 'Aún no hay respuestas de clientes.'}
            </p>
          ) : (
            <ul aria-label="Respuestas" className="grid gap-3">
              {data.data.map((s) => (
                <SurveyRow key={s.orderId} survey={s} />
              ))}
            </ul>
          )}
          <Pagination
            label="Páginas de encuestas"
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            pageSize={data.limit || SURVEYS_PAGE_SIZE}
            disabled={query.isPlaceholderData}
            hideWhenSingle
            onPageChange={(page) => go({ page })}
          />
        </>
      ) : null}
    </div>
  );
}
