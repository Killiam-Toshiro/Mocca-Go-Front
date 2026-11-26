'use client';

import { PackagePlus } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { describeApiError } from '@/lib/api/errors';
import type { CategoryFilter, StateFilter } from '@/lib/catalog/categories';
import { CATALOG_PAGE_SIZE, useCatalog } from '@/lib/catalog/use-catalog';
import { useDebouncedValue } from '@/lib/users/use-debounced-value';
import { CatalogFilters } from './catalog-filters';
import { CatalogList } from './catalog-list';
import { CatalogNotice } from './catalog-notice';
import { ProductPanel, type PanelState } from './product-panel';

const ROOT = 'mx-auto grid w-full max-w-5xl gap-6';

/** Pantalla «Catálogo» del admin (DP-01, DP-02): lista paginada con búsqueda y filtros del servidor. */
export function CatalogView() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<CategoryFilter>('todas');
  const [state, setState] = useState<StateFilter>('todos');
  const [pageState, setPageState] = useState({ page: 1, key: '' });
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);

  const debounced = useDebouncedValue(search.trim());
  // Al cambiar un filtro se vuelve a la página 1 sin efectos.
  const key = `${debounced}|${category}|${state}`;
  const page = pageState.key === key ? pageState.page : 1;
  const query = useCatalog({ page, search: debounced, category, state });
  const data = query.data;

  function announce(text: string) {
    setNotice(text);
    setPanel(null);
  }
  const stale = (messages: string[]) => {
    setPanel(null);
    setMissing([
      ...messages,
      'Actualizamos el catálogo para que veas el estado actual.',
    ]);
  };

  return (
    <div className={ROOT}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold">Catálogo</h1>
          <p className="text-muted-foreground">
            Crea productos y combos, ajusta precios y decide qué se vende.
          </p>
        </div>
        <Button
          type="button"
          className="min-h-12"
          onClick={() => {
            setNotice(null);
            setPanel({ kind: 'create' });
          }}
        >
          <PackagePlus aria-hidden />
          Crear producto
        </Button>
      </header>

      <CatalogFilters
        search={search}
        category={category}
        state={state}
        onSearch={setSearch}
        onCategory={setCategory}
        onState={setState}
      />

      <div role="status" className={notice ? 'grid' : 'sr-only'}>
        {notice ? (
          <p className="rounded-lg border bg-card px-4 py-3 text-sm font-medium">
            {notice}
          </p>
        ) : null}
      </div>
      <CatalogNotice messages={missing} onDismiss={() => setMissing([])} />

      {query.isPending ? (
        <div
          role="status"
          aria-label="Cargando catálogo"
          className="grid gap-3"
        >
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-28 w-full" />
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
            className="text-sm text-muted-foreground"
            aria-live="polite"
          >
            {query.isPlaceholderData
              ? 'Buscando…'
              : data.total === 1
                ? '1 resultado'
                : `${data.total} resultados`}
          </p>
          {data.data.length === 0 ? (
            <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">
              No hay productos que coincidan con la búsqueda.
            </p>
          ) : (
            <CatalogList
              products={data.data}
              onEdit={(product) => {
                setNotice(null);
                setPanel({ kind: 'product', product });
              }}
              onChanged={(_p, message) => setNotice(message)}
              onMissing={stale}
            />
          )}
          <Pagination
            label="Páginas del catálogo"
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            pageSize={data.limit || CATALOG_PAGE_SIZE}
            disabled={query.isPlaceholderData}
            onPageChange={(next) => setPageState({ page: next, key })}
          />
        </>
      ) : null}

      <ProductPanel
        panel={panel}
        onClose={() => setPanel(null)}
        onCreated={(p) =>
          announce(
            p.category === 'combo'
              ? `Combo ${p.name} creado. Su saldo sale de sus componentes.`
              : `Producto ${p.name} creado. Registra su producción en «Inventario» para venderlo.`,
          )
        }
        onSaved={(p) => setPanel({ kind: 'product', product: p })}
        onDeleted={(p) => announce(`Eliminamos ${p.name}.`)}
        onStatusChanged={(p) =>
          announce(
            p.active ? `${p.name} está activo.` : `${p.name} está inactivo.`,
          )
        }
        onMissing={stale}
      />
    </div>
  );
}
