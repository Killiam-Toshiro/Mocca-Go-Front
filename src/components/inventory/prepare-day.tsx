'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  buildPlan,
  preparable,
  summarize,
  summaryText,
  targetErrors,
} from '@/lib/inventory/day-plan';
import { DAY_REASON } from '@/lib/inventory/labels';
import { parseMovement } from '@/lib/inventory/movement';
import type { useFilteredProducts } from '@/lib/inventory/use-filtered-products';
import type { usePrepareDay } from '@/lib/inventory/use-prepare-day';
import { PrepareRow } from './prepare-row';
import { ProductFilters } from './product-filters';
import { ProductList } from './product-list';
import { ReasonField } from './reason-field';

const DAY_SUGGESTIONS = [DAY_REASON, 'Producción del día', 'Reposición'];

/**
 * «Preparar el día»: se escribe «Para hoy» por producto y se aplica en lote.
 * Cada producto es un movimiento aparte, en serie y sin reintento (D-079..D-082).
 */
export function PrepareDay({
  board,
  day,
  targets,
  onTargets,
  reason,
  onReason,
  onViewHistory,
}: {
  board: ReturnType<typeof useFilteredProducts>;
  day: ReturnType<typeof usePrepareDay>;
  targets: Record<string, string>;
  onTargets: (targets: Record<string, string>) => void;
  reason: string;
  onReason: (reason: string) => void;
  onViewHistory: () => void;
}) {
  const { state, run, clear } = day;
  const [confirming, setConfirming] = useState(false);
  const running = state.phase === 'running';

  const blocked = new Set(
    Object.entries(state.results)
      .filter(([, r]) => r.status === 'ambiguous')
      .map(([id]) => id),
  );
  const errors = targetErrors(board.all, targets);
  const plan = buildPlan(board.all, targets).filter((r) => !blocked.has(r.id));
  const summary = summarize(plan);
  const reasonCheck = parseMovement({ type: 'IN', quantity: '1', reason }, 0);
  const reasonError = reasonCheck.ok ? undefined : reasonCheck.errors.reason;
  const canReview =
    plan.length > 0 &&
    Object.keys(errors).length === 0 &&
    !reasonError &&
    !running;

  async function apply() {
    if (running) return;
    setConfirming(false);
    const outcome = await run(targets, reason.trim(), blocked);
    const next = { ...targets };
    for (const [id, result] of Object.entries(outcome)) {
      if (result.status === 'ok' || result.status === 'omitted')
        delete next[id];
    }
    onTargets(next);
  }

  const results = Object.values(state.results);
  const okCount = results.filter((r) => r.status === 'ok').length;
  const failedCount = results.filter((r) => r.status === 'failed').length;
  const ambiguousCount = results.filter((r) => r.status === 'ambiguous').length;

  const listBoard = { ...board, shown: preparable(board.shown) };

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        Escribe cuántos puedes entregar hoy de cada producto. Dejar el campo
        vacío no cambia nada.
      </p>

      <ReasonField
        id="reason-day"
        label="Motivo del lote"
        value={reason}
        onChange={onReason}
        error={reasonError}
        suggestions={DAY_SUGGESTIONS}
      />

      <ProductFilters filter={board.filter} onChange={board.setFilter} />
      <ProductList
        board={listBoard}
        render={(product) => (
          <PrepareRow
            key={product.id}
            product={product}
            value={targets[product.id] ?? ''}
            disabled={running}
            result={state.results[product.id]}
            onChange={(value) => onTargets({ ...targets, [product.id]: value })}
            onReviewed={() => clear(product.id)}
          />
        )}
      />

      {state.fatal ? (
        <Alert variant="destructive">
          <p>{state.fatal}</p>
        </Alert>
      ) : null}

      <p
        role="status"
        aria-live="polite"
        className="min-h-5 text-sm font-medium"
      >
        {running
          ? `Aplicando ${String(Math.min(state.progress.done + 1, state.progress.total))} de ${String(state.progress.total)}…`
          : state.phase === 'done'
            ? `${String(okCount)} aplicados, ${String(failedCount)} con error, ${String(ambiguousCount)} por revisar.`
            : ''}
      </p>

      {ambiguousCount > 0 ? (
        <Button
          type="button"
          variant="outline"
          className="min-h-12 justify-self-start"
          onClick={onViewHistory}
        >
          Ver historial
        </Button>
      ) : null}

      <div className="sticky bottom-0 grid gap-3 border-t bg-background py-3">
        {confirming ? (
          <div
            role="group"
            aria-label="Confirmar cambios"
            className="grid gap-3 rounded-xl border bg-card p-4"
          >
            <p className="font-medium">
              {summaryText(summary)} ({String(summary.unitsUp)} unidades más,{' '}
              {String(summary.unitsDown)} menos).
            </p>
            <div className="flex flex-wrap gap-3">
              <Button
                type="button"
                className="min-h-12"
                disabled={running || plan.length === 0}
                onClick={() => void apply()}
              >
                Aplicar {plan.length} {plan.length === 1 ? 'cambio' : 'cambios'}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="min-h-12"
                disabled={running}
                onClick={() => setConfirming(false)}
              >
                Volver
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            className="min-h-12 justify-self-start"
            disabled={!canReview}
            onClick={() => setConfirming(true)}
          >
            Revisar cambios
          </Button>
        )}
      </div>
    </div>
  );
}
