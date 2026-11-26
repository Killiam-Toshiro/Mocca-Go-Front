'use client';

import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatCount } from '@/lib/metrics/format';
import type { JobState } from '@/lib/export/use-export-job';

/**
 * Botón «Descargar Excel» con su estado (D-136): «Preparando…» con avance, resultado anunciado
 * (`role="status"`), cancelar con teclado y error con su texto (`role="alert"`).
 */
export function ExportControls({
  state,
  disabled = false,
  onStart,
  onCancel,
  onDismiss,
  cancellable = false,
  note,
}: {
  state: JobState;
  disabled?: boolean;
  onStart: () => void;
  onCancel?: () => void;
  onDismiss: () => void;
  cancellable?: boolean;
  /** Aviso fijo debajo (p. ej. el tope de filas). */
  note?: string;
}) {
  const working = state.status === 'working';
  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-12"
          disabled={disabled || working}
          aria-busy={working}
          onClick={onStart}
        >
          <Download aria-hidden />
          {working ? 'Preparando…' : 'Descargar Excel'}
        </Button>
        {working && cancellable ? (
          <Button
            type="button"
            variant="ghost"
            className="min-h-12"
            onClick={onCancel}
          >
            <X aria-hidden />
            Cancelar
          </Button>
        ) : null}
      </div>
      <div role="status" aria-live="polite" className="text-sm">
        {state.status === 'working' && state.total > 0 ? (
          <span className="grid gap-1">
            <span>
              Preparando… {formatCount(state.done)} de{' '}
              {formatCount(state.total)} respuestas
            </span>
            <progress
              value={state.done}
              max={state.total}
              className="h-2 w-full max-w-xs accent-[var(--chart-main)]"
              aria-label="Avance de la exportación"
            />
          </span>
        ) : null}
        {state.status === 'done' ? (
          <span className="text-muted-foreground">
            Descargado: {state.name}{' '}
            <button
              type="button"
              className="min-h-12 rounded-md px-2 text-brand-strong underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={onDismiss}
            >
              Entendido
            </button>
          </span>
        ) : null}
        {state.status === 'cancelled' ? (
          <span className="text-muted-foreground">
            Exportación cancelada. No se descargó nada.{' '}
            <button
              type="button"
              className="min-h-12 rounded-md px-2 text-brand-strong underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={onDismiss}
            >
              Entendido
            </button>
          </span>
        ) : null}
      </div>
      {state.status === 'error' ? (
        <p role="alert" className="text-sm text-destructive">
          {state.message}{' '}
          <button
            type="button"
            className="min-h-12 rounded-md px-2 underline underline-offset-4 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={onDismiss}
          >
            Entendido
          </button>
        </p>
      ) : null}
      {note ? <p className="text-xs text-muted-foreground">{note}</p> : null}
    </div>
  );
}
