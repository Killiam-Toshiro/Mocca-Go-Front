'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { DAY_REASON, DONE_LABEL } from '@/lib/inventory/labels';
import { useFilteredProducts } from '@/lib/inventory/use-filtered-products';
import { usePrepareDay } from '@/lib/inventory/use-prepare-day';
import { cn } from '@/lib/utils';
import { Freshness } from './freshness';
import { MovementHistory } from './movement-history';
import { PrepareDay } from './prepare-day';
import { ProductFilters } from './product-filters';
import { ProductList } from './product-list';
import { StockRow } from './stock-row';

type Section = 'saldos' | 'preparar' | 'historial';
const SECTIONS: [Section, string][] = [
  ['saldos', 'Disponibles'],
  ['preparar', 'Preparar el día'],
  ['historial', 'Historial'],
];

/** «Inventario»: saldos con «Registrar movimiento» e historial (D-065, D-068, D-072). */
export function InventoryView() {
  const board = useFilteredProducts();
  const { query, filter, setFilter, all } = board;
  const [section, setSection] = useState<Section>('saldos');
  const [openId, setOpenId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // El lote vive aquí para no perderse al cambiar de sección.
  const day = usePrepareDay();
  const [targets, setTargets] = useState<Record<string, string>>({});
  const [dayReason, setDayReason] = useState(DAY_REASON);

  function close(id: string) {
    setOpenId(null);
    setFocusId(id);
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-4">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <h1 className="font-display text-3xl font-semibold">Inventario</h1>
        <Freshness
          updatedAt={query.dataUpdatedAt}
          fetching={query.isFetching}
          onRefresh={() => void query.refetch()}
        />
      </div>

      <p
        role="status"
        aria-live="polite"
        className="min-h-5 text-sm font-medium"
      >
        {done}
      </p>
      {notice ? (
        <Alert
          variant="destructive"
          className="flex items-center justify-between gap-3"
        >
          <p>{notice}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setNotice(null)}
          >
            Entendido
          </Button>
        </Alert>
      ) : null}

      <div
        role="group"
        aria-label="Sección que se muestra"
        className="grid grid-cols-3 gap-1 sm:max-w-xl"
      >
        {SECTIONS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            aria-pressed={section === key}
            onClick={() => setSection(key)}
            className={cn(
              'flex min-h-12 items-center justify-center rounded-lg border px-3 text-base font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring',
              section === key
                ? 'bg-primary text-primary-foreground'
                : 'bg-card text-card-foreground',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {section === 'saldos' ? (
        <>
          <ProductFilters filter={filter} onChange={setFilter} />
          <ProductList
            board={board}
            render={(product) => (
              <StockRow
                key={product.id}
                product={product}
                open={openId === product.id}
                focus={focusId === product.id}
                onOpen={() => {
                  setFocusId(null);
                  setOpenId(product.id);
                }}
                onClose={() => close(product.id)}
                onCreated={(created) => {
                  close(product.id);
                  setDone(
                    `${DONE_LABEL[created.movement.type]}: ${product.name} queda con ${String(created.stock)} disponibles.`,
                  );
                }}
                onStale={(p, message) => {
                  setOpenId(null);
                  setNotice(`${p.name}: ${message}`);
                }}
                onViewHistory={() => {
                  setOpenId(null);
                  setSection('historial');
                }}
              />
            )}
          />
        </>
      ) : section === 'preparar' ? (
        <PrepareDay
          board={board}
          day={day}
          targets={targets}
          onTargets={setTargets}
          reason={dayReason}
          onReason={setDayReason}
          onViewHistory={() => setSection('historial')}
        />
      ) : (
        <MovementHistory products={all} />
      )}
    </div>
  );
}
