'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { clampPage, pageWindow, rangeLabel } from '@/lib/pagination';
import { cn } from '@/lib/utils';

/**
 * Paginador reutilizable (sirve con paginación del back o hecha en el front).
 * - «Anterior» / «Siguiente» (≥ 48 px) y «Página X de Y» siempre visibles.
 * - Desde `sm` también los números, con la primera, la última y huecos («…»), para saltar lejos.
 * - `total` + `pageSize` (opcionales) añaden «Mostrando 21–40 de 135».
 * No cambia de página por sí mismo: avisa con `onPageChange` y quien lo usa decide.
 */
export function Pagination({
  page,
  totalPages,
  onPageChange,
  total,
  pageSize,
  label = 'Paginación',
  disabled = false,
  hideWhenSingle = false,
  className,
}: {
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  total?: number;
  pageSize?: number;
  /** Nombre de la navegación para lectores de pantalla («Páginas del historial»). */
  label?: string;
  disabled?: boolean;
  hideWhenSingle?: boolean;
  className?: string;
}) {
  const pages = Math.max(1, totalPages);
  if (hideWhenSingle && pages <= 1) return null;
  const current = clampPage(page, pages);
  const go = (next: number) => {
    const target = clampPage(next, pages);
    if (target !== current) onPageChange(target);
  };
  const showRange = total !== undefined && pageSize !== undefined;

  return (
    <nav
      aria-label={label}
      className={cn('grid justify-items-start gap-2', className)}
    >
      {showRange ? (
        <p className="text-sm text-muted-foreground tabular-nums" role="status">
          Mostrando {rangeLabel(current, pageSize, total)}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="h-12 gap-1 text-base"
          disabled={disabled || current <= 1}
          onClick={() => go(current - 1)}
        >
          <ChevronLeft aria-hidden />
          Anterior
        </Button>

        <ol className="hidden items-center gap-1 sm:flex">
          {pageWindow(current, pages).map((item) =>
            typeof item === 'number' ? (
              <li key={item}>
                <Button
                  type="button"
                  variant={item === current ? 'default' : 'outline'}
                  className="size-12 px-0 text-base tabular-nums"
                  aria-label={`Página ${String(item)}`}
                  aria-current={item === current ? 'page' : undefined}
                  disabled={disabled}
                  onClick={() => go(item)}
                >
                  {item}
                </Button>
              </li>
            ) : (
              <li
                key={item}
                aria-hidden
                className="w-6 text-center text-muted-foreground"
              >
                …
              </li>
            ),
          )}
        </ol>

        <span
          className="px-1 text-sm text-muted-foreground tabular-nums"
          aria-live="polite"
        >
          Página {current} de {pages}
        </span>

        <Button
          type="button"
          variant="outline"
          className="h-12 gap-1 text-base"
          disabled={disabled || current >= pages}
          onClick={() => go(current + 1)}
        >
          Siguiente
          <ChevronRight aria-hidden />
        </Button>
      </div>
    </nav>
  );
}
