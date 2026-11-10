'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CATEGORY_LABEL } from '@/lib/inventory/availability';
import { STOCK_LABEL } from '@/lib/inventory/labels';
import { parseTarget } from '@/lib/inventory/day-plan';
import type { StaffProduct } from '@/lib/inventory/types';
import type { RowResult } from '@/lib/inventory/use-prepare-day';

function deltaText(delta: number): string {
  return delta > 0 ? `+${String(delta)}` : `−${String(Math.abs(delta))}`;
}

function ResultLine({
  product,
  result,
  onReviewed,
}: {
  product: StaffProduct;
  result: RowResult;
  onReviewed: () => void;
}) {
  switch (result.status) {
    case 'ok':
      return (
        <p className="text-sm font-medium text-foreground">
          ✓ Aplicado (
          {deltaText(result.type === 'IN' ? result.quantity : -result.quantity)}
          ): ahora hay {result.stock}.
        </p>
      );
    case 'omitted':
      return (
        <p className="text-sm text-muted-foreground">
          Sin cambios: ya estaba en {product.stock}.
        </p>
      );
    case 'failed':
      return (
        <div className="grid gap-1 text-sm text-destructive">
          {result.messages.map((m) => (
            <p key={m}>✗ {m}</p>
          ))}
        </div>
      );
    case 'ambiguous':
      return (
        <div className="grid gap-2 text-sm text-destructive">
          <p>✗ No sabemos si se registró: revisa el historial.</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-12 justify-self-start"
            aria-label={`Ya revisé el historial de ${product.name}`}
            onClick={onReviewed}
          >
            Ya lo revisé
          </Button>
        </div>
      );
  }
}

/** Una fila de «Preparar el día»: saldo actual, campo «Para hoy» y diferencia. */
export function PrepareRow({
  product,
  value,
  disabled,
  result,
  onChange,
  onReviewed,
}: {
  product: StaffProduct;
  value: string;
  disabled: boolean;
  result?: RowResult;
  onChange: (value: string) => void;
  onReviewed: () => void;
}) {
  const parsed = parseTarget(value);
  const error = parsed.ok ? undefined : parsed.error;
  const delta =
    parsed.ok && parsed.value !== null ? parsed.value - product.stock : 0;
  const inputId = `hoy-${product.id}`;
  const locked = disabled || result?.status === 'ambiguous';
  return (
    <li className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
        <div className="min-w-0">
          <h3 className="font-display text-lg font-semibold">{product.name}</h3>
          <p className="text-sm text-muted-foreground">
            {product.sku} · {CATEGORY_LABEL[product.category]}
          </p>
        </div>
        <p className="text-sm text-muted-foreground">
          {STOCK_LABEL} ahora{' '}
          <span className="text-base font-semibold text-foreground tabular-nums">
            {product.stock}
          </span>
        </p>
      </div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor={inputId}>Para hoy: {product.name}</Label>
          <Input
            id={inputId}
            inputMode="numeric"
            autoComplete="off"
            className="h-12 w-40 text-base"
            value={value}
            disabled={locked}
            placeholder="Sin cambio"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${inputId}-error` : undefined}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
        {delta !== 0 ? (
          <p
            className="pb-3 text-base font-semibold tabular-nums"
            aria-label={`Diferencia de ${product.name}: ${deltaText(delta)}`}
          >
            {deltaText(delta)}
          </p>
        ) : null}
      </div>
      {error ? (
        <p id={`${inputId}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {result ? (
        <ResultLine product={product} result={result} onReviewed={onReviewed} />
      ) : null}
    </li>
  );
}
