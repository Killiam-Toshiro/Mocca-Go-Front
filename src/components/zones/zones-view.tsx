'use client';

import { MapPinned } from 'lucide-react';
import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { describeApiError } from '@/lib/api/errors';
import { useAdminZones } from '@/lib/zones/use-admin-zones';
import { ZoneCard } from './zone-card';
import { ZonesNotice } from './zones-notice';
import { ZonesPanel, type PanelState } from './zones-panel';

const ROOT = 'mx-auto grid w-full max-w-4xl gap-6';

/** Pantalla «Zonas y puntos» del admin (DP-01): una tarjeta por zona con sus puntos. */
export function ZonesView() {
  const query = useAdminZones();
  const zones = query.data;
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);

  function announce(text: string) {
    setNotice(text);
    setPanel(null);
  }
  const stale = (messages: string[]) => {
    setPanel(null);
    setMissing([
      ...messages,
      'Actualizamos la lista para que veas el estado actual.',
    ]);
  };

  return (
    <div className={ROOT}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold">Zonas y puntos</h1>
          <p className="text-muted-foreground">
            Define dónde se entrega: lo que actives es lo que los clientes ven
            al pagar.
          </p>
        </div>
        <Button
          type="button"
          className="min-h-12"
          onClick={() => {
            setNotice(null);
            setPanel({ kind: 'zone-create' });
          }}
        >
          <MapPinned aria-hidden />
          Crear zona
        </Button>
      </header>

      <div role="status" className={notice ? 'grid' : 'sr-only'}>
        {notice ? (
          <p className="rounded-lg border bg-card px-4 py-3 text-sm font-medium">
            {notice}
          </p>
        ) : null}
      </div>
      <ZonesNotice messages={missing} onDismiss={() => setMissing([])} />

      {query.isPending ? (
        <div role="status" aria-label="Cargando zonas" className="grid gap-3">
          {[0, 1].map((i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : query.isError && !zones ? (
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
      ) : zones ? (
        zones.length === 0 ? (
          <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">
            Aún no hay zonas. Crea la primera.
          </p>
        ) : (
          <div className="grid gap-4">
            {zones.map((zone) => (
              <ZoneCard
                key={zone.id}
                zone={zone}
                zones={zones}
                onRename={(z) => {
                  setNotice(null);
                  setPanel({ kind: 'zone-edit', zone: z });
                }}
                onAddPoint={(z) => {
                  setNotice(null);
                  setPanel({ kind: 'point-create', zoneId: z.id });
                }}
                onEditPoint={(point) => {
                  setNotice(null);
                  setPanel({ kind: 'point-edit', point });
                }}
                onChanged={setNotice}
                onMissing={stale}
              />
            ))}
          </div>
        )
      ) : null}

      <ZonesPanel
        panel={panel}
        zones={zones ?? []}
        onClose={() => setPanel(null)}
        onZoneSaved={(zone, created) =>
          announce(
            created
              ? `Creamos la zona ${zone.name}. Agrega sus puntos de entrega.`
              : `Guardamos la zona ${zone.name}.`,
          )
        }
        onPointSaved={(point, created) =>
          announce(
            created
              ? `Agregamos el punto ${point.name}.`
              : `Guardamos el punto ${point.name}.`,
          )
        }
        onMissing={stale}
      />
    </div>
  );
}
