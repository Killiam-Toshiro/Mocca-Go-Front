'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { describeApiError } from '@/lib/api/errors';
import { useLiveStatus } from '@/lib/live/channel';
import { STATUS_FILTERS, type StatusFilter } from '@/lib/staff-orders/filters';
import {
  STAFF_ORDERS_PAGE_SIZE,
  useStaffOrders,
} from '@/lib/staff-orders/use-staff-orders';
import { StaffOrderRow } from './staff-order-row';

/** Lista de todos los pedidos con filtro por estado (D-120). `base` = `/admin` u `/operador`. */
export function StaffOrdersView({ base }: { base: string }) {
  const [status, setStatus] = useState<StatusFilter>('todos');
  const [pageState, setPageState] = useState({ page: 1, key: 'todos' });
  const page = pageState.key === status ? pageState.page : 1;
  const query = useStaffOrders(page, status);
  const data = query.data;
  const live = useLiveStatus();

  return (
    <div className="mx-auto grid w-full max-w-4xl gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold">Pedidos</h1>
        <p className="text-muted-foreground">
          Todos los pedidos, del más reciente al más antiguo.
          {live === 'live' ? ' Se actualizan en vivo.' : ''}
        </p>
      </header>

      <div className="grid max-w-xs gap-1.5">
        <Label htmlFor="orders-status">Estado</Label>
        <Select
          id="orders-status"
          value={status}
          onChange={(e) => setStatus(e.target.value as StatusFilter)}
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>
              {f.label}
            </option>
          ))}
        </Select>
      </div>

      {query.isPending ? (
        <div role="status" aria-label="Cargando pedidos" className="grid gap-3">
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
                ? '1 pedido'
                : `${String(data.total)} pedidos`}
          </p>
          {data.data.length === 0 ? (
            <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">
              No hay pedidos con este estado.
            </p>
          ) : (
            <ul className="grid gap-3">
              {data.data.map((order) => (
                <StaffOrderRow key={order.id} order={order} base={base} />
              ))}
            </ul>
          )}
          <Pagination
            label="Páginas de pedidos"
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            pageSize={data.limit || STAFF_ORDERS_PAGE_SIZE}
            disabled={query.isPlaceholderData}
            hideWhenSingle
            onPageChange={(next) => setPageState({ page: next, key: status })}
          />
        </>
      ) : null}
    </div>
  );
}
