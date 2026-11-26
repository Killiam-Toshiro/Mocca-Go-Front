'use client';

import { RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { freshnessLabel } from '@/lib/inventory/format';
import { useTicker } from '@/lib/inventory/use-ticker';

/** «Actualizado hace N s» y un botón para consultar ya (D-069). */
export function Freshness({
  updatedAt,
  fetching,
  onRefresh,
}: {
  updatedAt: number;
  fetching: boolean;
  onRefresh: () => void;
}) {
  const now = useTicker(5_000);
  return (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      {updatedAt > 0 ? <span>{freshnessLabel(updatedAt, now)}</span> : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-10"
        onClick={onRefresh}
        disabled={fetching}
        aria-label="Actualizar la lista"
      >
        <RefreshCw
          className={fetching ? 'animate-spin' : undefined}
          aria-hidden
        />
        Actualizar
      </Button>
    </div>
  );
}
