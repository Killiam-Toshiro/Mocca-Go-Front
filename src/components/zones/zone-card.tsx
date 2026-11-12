'use client';

import { MapPinPlus, Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ErrorAlert } from '@/components/auth/error-alert';
import { Button } from '@/components/ui/button';
import { hiddenByZone, zoneLeavesNone } from '@/lib/zones/schemas';
import type { AdminPoint, AdminZone } from '@/lib/zones/types';
import { useDeleteZone, useUpdateZone } from '@/lib/zones/use-zone-actions';
import { ActiveBadge } from './active-badge';
import { ConfirmBox } from './confirm-box';
import { PointRow } from './point-row';
import { ZonesNotice } from './zones-notice';

const NONE_LEFT =
  'Los clientes no podrán hacer pedidos hasta que actives otro punto.';

/** Una zona con sus puntos y sus acciones (DP-01, DP-03, DP-05). */
export function ZoneCard({
  zone,
  zones,
  onRename,
  onAddPoint,
  onEditPoint,
  onChanged,
  onMissing,
}: {
  zone: AdminZone;
  zones: readonly AdminZone[];
  onRename: (zone: AdminZone) => void;
  onAddPoint: (zone: AdminZone) => void;
  onEditPoint: (point: AdminPoint) => void;
  onChanged: (message: string) => void;
  onMissing: (messages: string[]) => void;
}) {
  const [confirming, setConfirming] = useState<'status' | 'delete' | null>(
    null,
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);

  const status = useUpdateZone({
    onDone: (saved) => {
      setConfirming(null);
      onChanged(
        saved.active
          ? `La zona ${saved.name} está activa.`
          : `La zona ${saved.name} está inactiva: sus puntos ya no se ven para los clientes.`,
      );
    },
    onFail: (error) => {
      setConfirming(null);
      if (error.kind === 'missing') return onMissing(error.messages);
      setErrors(error.messages);
    },
  });
  const remove = useDeleteZone({
    onDone: () => {
      setConfirming(null);
      onChanged(`Eliminamos la zona ${zone.name}.`);
    },
    onFail: (error) => {
      setConfirming(null);
      if (error.kind === 'missing') return onMissing(error.messages);
      if (error.kind === 'history' || error.kind === 'conflict')
        return setHistory(error.messages);
      setErrors(error.messages);
    },
  });

  const hidden = hiddenByZone(zone);
  const leavesNone = zone.active && zoneLeavesNone(zones, zone.id);
  const verb = zone.active ? 'Desactivar' : 'Activar';
  const titleId = `zone-${zone.id}`;

  return (
    <section
      aria-labelledby={titleId}
      className="grid gap-4 rounded-2xl border bg-muted/40 p-4"
    >
      <header className="grid gap-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id={titleId} className="font-display text-xl font-semibold">
            {zone.name}
          </h2>
          <ActiveBadge active={zone.active} feminine />
        </div>
        <p className="text-sm text-muted-foreground">
          {zone.points.length === 0
            ? 'Sin puntos todavía'
            : `${String(zone.points.length)} ${zone.points.length === 1 ? 'punto' : 'puntos'}`}
        </p>
      </header>

      <ErrorAlert messages={errors} />
      <ZonesNotice
        messages={history}
        onDismiss={() => setHistory([])}
        action={
          zone.active
            ? {
                label: 'Desactivar',
                onClick: () => {
                  setHistory([]);
                  setConfirming('status');
                },
              }
            : undefined
        }
      />
      {confirming === 'status' ? (
        <ConfirmBox
          label={`Confirmar ${verb.toLowerCase()} la zona ${zone.name}`}
          text={
            zone.active
              ? hidden > 0
                ? `¿Desactivar la zona ${zone.name}? Sus ${String(hidden)} ${hidden === 1 ? 'punto activo dejará' : 'puntos activos dejarán'} de verse para los clientes.`
                : `¿Desactivar la zona ${zone.name}?`
              : `¿Activar la zona ${zone.name}? Sus puntos activos volverán a verse para los clientes.`
          }
          warnings={zone.active && leavesNone ? [NONE_LEFT] : []}
          confirmLabel={`Sí, ${verb.toLowerCase()}`}
          busyLabel="Guardando…"
          pending={status.pending}
          onConfirm={() => {
            setErrors([]);
            void status.run({ zone, body: { active: !zone.active } });
          }}
          onCancel={() => setConfirming(null)}
        />
      ) : null}
      {confirming === 'delete' ? (
        <ConfirmBox
          label={`Confirmar eliminación de la zona ${zone.name}`}
          text={`¿Eliminar la zona ${zone.name}? No se puede deshacer.`}
          confirmLabel="Sí, eliminar"
          busyLabel="Eliminando…"
          destructive
          pending={remove.pending}
          onConfirm={() => {
            setErrors([]);
            setHistory([]);
            void remove.run(zone);
          }}
          onCancel={() => setConfirming(null)}
        />
      ) : null}
      {confirming === null ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="min-h-12"
            aria-label={`Renombrar ${zone.name}`}
            onClick={() => onRename(zone)}
          >
            <Pencil aria-hidden />
            Renombrar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-12"
            aria-label={`${verb} la zona ${zone.name}`}
            onClick={() => {
              setErrors([]);
              setHistory([]);
              setConfirming('status');
            }}
          >
            {verb}
          </Button>
          {zone.points.length === 0 ? (
            <Button
              type="button"
              variant="outline"
              className="min-h-12"
              aria-label={`Eliminar la zona ${zone.name}`}
              onClick={() => {
                setErrors([]);
                setHistory([]);
                setConfirming('delete');
              }}
            >
              <Trash2 aria-hidden />
              Eliminar
            </Button>
          ) : null}
          <Button
            type="button"
            className="min-h-12"
            aria-label={`Agregar punto a ${zone.name}`}
            onClick={() => onAddPoint(zone)}
          >
            <MapPinPlus aria-hidden />
            Agregar punto
          </Button>
        </div>
      ) : null}
      {zone.points.length > 0 && confirming === null ? (
        <p className="text-sm text-muted-foreground">
          Para eliminar la zona, mueve o elimina antes sus puntos.
        </p>
      ) : null}

      {zone.points.length > 0 ? (
        <ul aria-label={`Puntos de ${zone.name}`} className="grid gap-3">
          {zone.points.map((point) => (
            <PointRow
              key={point.id}
              point={point}
              zone={zone}
              zones={zones}
              onEdit={onEditPoint}
              onChanged={onChanged}
              onMissing={onMissing}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
