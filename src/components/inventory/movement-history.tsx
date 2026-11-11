'use client';

import { ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Pagination } from '@/components/ui/pagination';
import { Select } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { describeApiError } from '@/lib/api/errors';
import { shortOrderId } from '@/lib/inventory/format';
import { TYPE_LABEL } from '@/lib/inventory/labels';
import type {
  Movement,
  MovementType,
  StaffProduct,
} from '@/lib/inventory/types';
import { useMovements } from '@/lib/inventory/use-movements';
import { formatOrderDate } from '@/lib/orders/format';
import { cn } from '@/lib/utils';

function MovementItem({
  movement,
  name,
}: {
  movement: Movement;
  name: string;
}) {
  const entry = movement.type === 'IN';
  const Icon = entry ? ArrowDownToLine : ArrowUpFromLine;
  return (
    <li className="grid gap-1 rounded-xl border bg-card p-4 shadow-sm md:grid-cols-[minmax(0,2fr)_auto_auto] md:items-center md:gap-4">
      <div className="min-w-0">
        <h3 className="font-semibold">{name}</h3>
        <p className="text-sm break-words text-muted-foreground">
          {movement.reason}
        </p>
        <p className="text-sm text-muted-foreground">
          {formatOrderDate(movement.createdAt)} · {movement.user.username}
          {movement.orderId ? (
            <> · Automático · pedido {shortOrderId(movement.orderId)}</>
          ) : null}
        </p>
      </div>
      <span
        className={cn(
          'inline-flex items-center gap-1.5 justify-self-start rounded-full border px-2.5 py-1 text-sm font-semibold whitespace-nowrap',
          entry
            ? 'border-transparent bg-secondary text-secondary-foreground'
            : 'border-input bg-card text-foreground',
        )}
      >
        <Icon className="size-4" aria-hidden />
        {TYPE_LABEL[movement.type]}
      </span>
      <p className="text-lg font-semibold tabular-nums md:text-right">
        {entry ? '+' : '−'}
        {movement.quantity}
        <span className="sr-only"> unidades</span>
      </p>
    </li>
  );
}

/** Historial de movimientos, el más reciente primero, con filtros y paginación (D-072). */
export function MovementHistory({ products }: { products: StaffProduct[] }) {
  const [page, setPage] = useState(1);
  const [productId, setProductId] = useState<string | null>(null);
  const [type, setType] = useState<MovementType | null>(null);
  const query = useMovements({ page, productId, type });
  const names = new Map(products.map((p) => [p.id, p.name]));
  const data = query.data;

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <div className="grid gap-1.5">
          <Label htmlFor="history-product">Producto</Label>
          <Select
            id="history-product"
            value={productId ?? ''}
            onChange={(e) => {
              setProductId(e.target.value || null);
              setPage(1);
            }}
          >
            <option value="">Todos los productos</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="history-type">Tipo</Label>
          <Select
            id="history-type"
            value={type ?? ''}
            onChange={(e) => {
              setType((e.target.value || null) as MovementType | null);
              setPage(1);
            }}
          >
            <option value="">Todos los tipos</option>
            <option value="IN">{TYPE_LABEL.IN}</option>
            <option value="OUT">{TYPE_LABEL.OUT}</option>
          </Select>
        </div>
      </div>

      {query.isPending ? (
        <div
          aria-busy="true"
          aria-label="Cargando movimientos"
          className="grid gap-3"
        >
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : query.isError && !data ? (
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
      ) : !data || data.data.length === 0 ? (
        <p className="text-muted-foreground">
          {productId || type
            ? 'Ningún movimiento coincide con los filtros.'
            : 'Todavía no hay movimientos.'}
        </p>
      ) : (
        <>
          <ul className="grid gap-3">
            {data.data.map((m) => (
              <MovementItem
                key={m.id}
                movement={m}
                name={names.get(m.productId) ?? 'Producto eliminado'}
              />
            ))}
          </ul>
          <Pagination
            label="Páginas del historial"
            page={page}
            totalPages={data.totalPages}
            total={data.total}
            pageSize={data.limit}
            onPageChange={setPage}
          />
        </>
      )}
    </div>
  );
}
