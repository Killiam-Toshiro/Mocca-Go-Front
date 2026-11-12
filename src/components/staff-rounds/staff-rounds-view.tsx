'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { describeApiError } from '@/lib/api/errors';
import { useNow } from '@/lib/kitchen/use-now';
import { ROUND_FILTERS, type RoundFilter } from '@/lib/staff-rounds/filters';
import {
  STAFF_ROUNDS_PAGE_SIZE,
  useStaffRounds,
} from '@/lib/staff-rounds/use-staff-rounds';
import { StaffRoundRow } from './staff-round-row';

/** Rondas de todos los repartidores; se refresca cada 15 s solo con la pestaña visible (D-122, D-123). */
export function StaffRoundsView({ base }: { base: string }) {
  const [status, setStatus] = useState<RoundFilter>('todas');
  const [pageState, setPageState] = useState({ page: 1, key: 'todas' });
  const page = pageState.key === status ? pageState.page : 1;
  const query = useStaffRounds(page, status);
  const now = useNow();
  const data = query.data;

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold">Rondas</h1>
        <p className="text-muted-foreground">
          Las rondas de reparto de todos los repartidores.
        </p>
      </header>

      <div className="grid max-w-xs gap-1.5">
        <Label htmlFor="rounds-status">Estado</Label>
        <Select
          id="rounds-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as RoundFilter)}
        >
          {ROUND_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>

      {query.isPending ? (
        <div role="status" aria-label="Cargando rondas" className="grid gap-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : query.isError && !data ? (
        <Alert variant="destructive" className="grid gap-3">
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
                ? '1 ronda'
                : `${String(data.total)} rondas`}
          </p>
          {data.data.length === 0 ? (
            <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">
              No hay rondas con este estado.
            </p>
          ) : (
            <ul className="grid gap-3">
              {data.data.map((round) => (
                <StaffRoundRow
                  key={round.id}
                  round={round}
                  base={base}
                  now={now}
                />
              ))}
            </ul>
          )}
          <Pagination
            label="Páginas de rondas"
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            pageSize={data.limit || STAFF_ROUNDS_PAGE_SIZE}
            disabled={query.isPlaceholderData}
            hideWhenSingle
            onPageChange={(next) => setPageState({ page: next, key: status })}
          />
        </>
      ) : null}
    </div>
  );
}
