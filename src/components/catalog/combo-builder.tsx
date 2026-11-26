'use client';

import { Plus, Trash2 } from 'lucide-react';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import {
  comboTotals,
  MAX_COMPONENTS,
  MAX_QUANTITY,
  MIN_COMPONENTS,
  type ComponentPick,
} from '@/lib/catalog/schemas';
import { useComponentOptions } from '@/lib/catalog/use-catalog';
import { useDebouncedValue } from '@/lib/users/use-debounced-value';
import { formatCOP } from '@/lib/menu/format';

/**
 * Armar la composición de un combo (DP-05): busca productos simples y activos, cantidad de 1 a 10,
 * entre 2 y 10 distintos, con la suma de precios y el costo calculados en vivo.
 */
export function ComboBuilder({
  value,
  onChange,
  error,
  note,
}: {
  value: ComponentPick[];
  onChange: (next: ComponentPick[]) => void;
  error?: string | undefined;
  /** Aviso extra bajo los totales (p. ej. componentes sin precio conocido). */
  note?: string | undefined;
}) {
  const id = useId();
  const [search, setSearch] = useState('');
  const debounced = useDebouncedValue(search.trim());
  const options = useComponentOptions(debounced, true);
  const totals = comboTotals(value);
  const chosen = new Set(value.map((c) => c.productId));
  const full = value.length >= MAX_COMPONENTS;
  const errorId = `${id}-error`;

  return (
    <fieldset
      className="grid gap-4 rounded-lg border p-4"
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="px-1 text-sm font-semibold">Composición</legend>
      <p className="text-sm text-muted-foreground">
        Elige entre {MIN_COMPONENTS} y {MAX_COMPONENTS} productos distintos
        (solo simples y activos).
      </p>

      {value.length > 0 ? (
        <ul aria-label="Componentes elegidos" className="grid gap-2">
          {value.map((c, index) => (
            <li
              key={c.productId}
              className="grid grid-cols-[minmax(0,1fr)_5rem_auto] items-center gap-2"
            >
              <span className="min-w-0 text-sm break-words">
                <span className="font-medium">{c.name}</span>{' '}
                <span className="text-muted-foreground">
                  {c.sku} · {formatCOP(c.price)}
                </span>
              </span>
              <Select
                aria-label={`Cantidad de ${c.name}`}
                value={c.quantity}
                onChange={(e) =>
                  onChange(
                    value.map((v, i) =>
                      i === index
                        ? { ...v, quantity: Number(e.target.value) }
                        : v,
                    ),
                  )
                }
              >
                {Array.from({ length: MAX_QUANTITY }, (_, i) => i + 1).map(
                  (n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ),
                )}
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-12"
                aria-label={`Quitar ${c.name}`}
                onClick={() => onChange(value.filter((_, i) => i !== index))}
              >
                <Trash2 aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Aún no hay componentes.</p>
      )}

      <p role="status" className="text-sm font-medium">
        Suma de precios {formatCOP(totals.price)} · Costo calculado{' '}
        {formatCOP(totals.cost)}
      </p>
      {note ? <p className="text-sm text-muted-foreground">{note}</p> : null}
      {error ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="grid gap-2">
        <Label htmlFor={`${id}-search`}>Buscar componente</Label>
        <Input
          id={`${id}-search`}
          type="search"
          className="h-11"
          placeholder="SKU o nombre"
          maxLength={100}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {options.isError ? (
          <p className="text-sm text-destructive" role="alert">
            No pudimos cargar los productos.{' '}
            <button
              type="button"
              className="underline"
              onClick={() => void options.refetch()}
            >
              Reintentar
            </button>
          </p>
        ) : options.isPending ? (
          <p className="text-sm text-muted-foreground" role="status">
            Cargando productos…
          </p>
        ) : (options.data ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No hay productos simples y activos que coincidan.
          </p>
        ) : (
          <ul
            aria-label="Productos disponibles"
            className="grid max-h-56 gap-1 overflow-y-auto"
          >
            {(options.data ?? []).map((p) => (
              <li
                key={p.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-1"
              >
                <span className="min-w-0 text-sm break-words">
                  {p.name}{' '}
                  <span className="text-muted-foreground">
                    {p.sku} · {formatCOP(p.price)}
                  </span>
                </span>
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-12"
                  disabled={chosen.has(p.id) || full}
                  aria-label={`Agregar ${p.name}`}
                  onClick={() =>
                    onChange([
                      ...value,
                      {
                        productId: p.id,
                        sku: p.sku,
                        name: p.name,
                        quantity: 1,
                        price: p.price,
                        cost: p.cost,
                      },
                    ])
                  }
                >
                  <Plus aria-hidden />
                  {chosen.has(p.id) ? 'Agregado' : 'Agregar'}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </fieldset>
  );
}
