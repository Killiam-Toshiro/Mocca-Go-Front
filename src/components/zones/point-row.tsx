'use client';

import { Pencil, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ErrorAlert } from '@/components/auth/error-alert';
import { Button } from '@/components/ui/button';
import { pointLeavesNone } from '@/lib/zones/schemas';
import type { AdminPoint, AdminZone } from '@/lib/zones/types';
import { useDeletePoint, useUpdatePoint } from '@/lib/zones/use-zone-actions';
import { ActiveBadge } from './active-badge';
import { ConfirmBox } from './confirm-box';
import { ZonesNotice } from './zones-notice';

const NONE_LEFT =
  'Los clientes no podrán hacer pedidos hasta que actives otro punto.';

/** Un punto: datos, estado y sus acciones (editar, activar/desactivar, eliminar) con confirmación. */
export function PointRow({
  point,
  zone,
  zones,
  onEdit,
  onChanged,
  onMissing,
}: {
  point: AdminPoint;
  zone: AdminZone;
  zones: readonly AdminZone[];
  onEdit: (point: AdminPoint) => void;
  onChanged: (message: string) => void;
  onMissing: (messages: string[]) => void;
}) {
  const [confirming, setConfirming] = useState<'status' | 'delete' | null>(
    null,
  );
  const [errors, setErrors] = useState<string[]>([]);
  const [history, setHistory] = useState<string[]>([]);

  const status = useUpdatePoint({
    onDone: (saved) => {
      setConfirming(null);
      onChanged(
        saved.active
          ? `${saved.name} está activo.`
          : `${saved.name} está inactivo: los clientes ya no lo ven.`,
      );
    },
    onFail: (error) => {
      setConfirming(null);
      if (error.kind === 'missing') return onMissing(error.messages);
      setErrors(error.messages);
    },
  });
  const remove = useDeletePoint({
    onDone: () => {
      setConfirming(null);
      onChanged(`Eliminamos el punto ${point.name}.`);
    },
    onFail: (error) => {
      setConfirming(null);
      if (error.kind === 'missing') return onMissing(error.messages);
      if (error.kind === 'history') return setHistory(error.messages);
      setErrors(error.messages);
    },
  });

  const visible = point.active && zone.active;
  const leavesNone = visible && pointLeavesNone(zones, point.id);
  const verb = point.active ? 'Desactivar' : 'Activar';

  return (
    <li className="grid gap-3 rounded-xl border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="font-display text-lg font-semibold">{point.name}</h4>
        <ActiveBadge active={point.active} />
      </div>
      <p className="text-sm text-muted-foreground">
        {point.floors === null
          ? 'Sin pisos'
          : `${String(point.floors)} ${point.floors === 1 ? 'piso' : 'pisos'}`}
        {point.hint ? ` · ${point.hint}` : ''}
      </p>
      <ErrorAlert messages={errors} />
      <ZonesNotice
        messages={history}
        onDismiss={() => setHistory([])}
        action={
          point.active
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
          label={`Confirmar ${verb.toLowerCase()} ${point.name}`}
          text={
            point.active
              ? `¿Desactivar ${point.name}? Los clientes dejarán de verlo al pedir.`
              : `¿Activar ${point.name}? Los clientes volverán a verlo al pedir.`
          }
          warnings={point.active && leavesNone ? [NONE_LEFT] : []}
          confirmLabel={`Sí, ${verb.toLowerCase()}`}
          busyLabel="Guardando…"
          pending={status.pending}
          onConfirm={() => {
            setErrors([]);
            void status.run({ point, body: { active: !point.active } });
          }}
          onCancel={() => setConfirming(null)}
        />
      ) : null}
      {confirming === 'delete' ? (
        <ConfirmBox
          label={`Confirmar eliminación de ${point.name}`}
          text={`¿Eliminar ${point.name}? No se puede deshacer.`}
          warnings={leavesNone ? [NONE_LEFT] : []}
          confirmLabel="Sí, eliminar"
          busyLabel="Eliminando…"
          destructive
          pending={remove.pending}
          onConfirm={() => {
            setErrors([]);
            setHistory([]);
            void remove.run(point);
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
            aria-label={`Editar ${point.name}`}
            onClick={() => onEdit(point)}
          >
            <Pencil aria-hidden />
            Editar
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-12"
            aria-label={`${verb} ${point.name}`}
            onClick={() => {
              setErrors([]);
              setHistory([]);
              setConfirming('status');
            }}
          >
            {verb}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="min-h-12"
            aria-label={`Eliminar ${point.name}`}
            onClick={() => {
              setErrors([]);
              setHistory([]);
              setConfirming('delete');
            }}
          >
            <Trash2 aria-hidden />
            Eliminar
          </Button>
        </div>
      ) : null}
    </li>
  );
}
