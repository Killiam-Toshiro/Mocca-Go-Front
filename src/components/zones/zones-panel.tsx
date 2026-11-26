'use client';

import { DialogPanel } from '@/components/ui/dialog-panel';
import type { AdminPoint, AdminZone } from '@/lib/zones/types';
import { PointForm } from './point-form';
import { ZoneForm } from './zone-form';

export type PanelState =
  | { kind: 'zone-create' }
  | { kind: 'zone-edit'; zone: AdminZone }
  | { kind: 'point-create'; zoneId: string }
  | { kind: 'point-edit'; point: AdminPoint };

/** Panel de crear/editar zona o punto (DP-02). Cada apertura empieza de cero. */
export function ZonesPanel({
  panel,
  zones,
  onClose,
  onZoneSaved,
  onPointSaved,
  onMissing,
}: {
  panel: PanelState | null;
  zones: readonly AdminZone[];
  onClose: () => void;
  onZoneSaved: (zone: AdminZone, created: boolean) => void;
  onPointSaved: (point: AdminPoint, created: boolean) => void;
  onMissing: (messages: string[]) => void;
}) {
  const title =
    panel?.kind === 'zone-create'
      ? 'Crear zona'
      : panel?.kind === 'zone-edit'
        ? `Renombrar ${panel.zone.name}`
        : panel?.kind === 'point-create'
          ? 'Agregar punto'
          : panel?.kind === 'point-edit'
            ? `Editar ${panel.point.name}`
            : '';
  return (
    <DialogPanel open={panel !== null} onClose={onClose} title={title}>
      <div className="p-4">
        {panel?.kind === 'zone-create' ? (
          <ZoneForm onSaved={onZoneSaved} onMissing={onMissing} />
        ) : null}
        {panel?.kind === 'zone-edit' ? (
          <ZoneForm
            key={panel.zone.id}
            zone={panel.zone}
            onSaved={onZoneSaved}
            onMissing={onMissing}
          />
        ) : null}
        {panel?.kind === 'point-create' ? (
          <PointForm
            zoneId={panel.zoneId}
            zones={zones}
            onSaved={onPointSaved}
            onMissing={onMissing}
          />
        ) : null}
        {panel?.kind === 'point-edit' ? (
          <PointForm
            key={panel.point.id}
            point={panel.point}
            zones={zones}
            onSaved={onPointSaved}
            onMissing={onMissing}
          />
        ) : null}
      </div>
    </DialogPanel>
  );
}
