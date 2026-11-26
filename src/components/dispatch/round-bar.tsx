'use client';

import { Button } from '@/components/ui/button';
import { MAX_ROUND_ORDERS } from '@/lib/dispatch/selection';

/** Barra fija con «Salir con la sugerencia» y «Salir con N pedidos» (DP-03, DP-04). */
export function RoundBar({
  picked,
  anyReady,
  limitReached,
  pending,
  onSuggested,
  onChosen,
  onClear,
}: {
  picked: number;
  anyReady: boolean;
  limitReached: boolean;
  pending: boolean;
  onSuggested: () => void;
  onChosen: () => void;
  onClear: () => void;
}) {
  return (
    <div className="sticky bottom-0 z-10 grid gap-2 border-t bg-background py-3">
      {limitReached ? (
        <p id="round-limit" className="text-sm font-medium text-destructive">
          Ya tienes 2 rondas activas: termina una para salir de nuevo.
        </p>
      ) : null}
      {picked > 0 ? (
        <p className="text-sm font-medium" aria-live="polite">
          {picked} de {MAX_ROUND_ORDERS} pedidos elegidos
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {picked > 0 ? (
          <>
            <Button
              type="button"
              className="min-h-12 text-base"
              disabled={limitReached || pending}
              aria-describedby={limitReached ? 'round-limit' : undefined}
              onClick={onChosen}
            >
              {pending
                ? 'Saliendo…'
                : `Salir con ${String(picked)} ${picked === 1 ? 'pedido' : 'pedidos'}`}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-12 text-base"
              disabled={pending}
              onClick={onClear}
            >
              Quitar elección
            </Button>
          </>
        ) : (
          <Button
            type="button"
            className="min-h-12 text-base"
            disabled={!anyReady || limitReached || pending}
            aria-describedby={limitReached ? 'round-limit' : undefined}
            onClick={onSuggested}
          >
            {pending ? 'Saliendo…' : 'Salir con la sugerencia'}
          </Button>
        )}
      </div>
    </div>
  );
}
