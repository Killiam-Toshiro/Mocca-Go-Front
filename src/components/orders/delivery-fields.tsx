'use client';

import { FormField } from '@/components/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { NOTE_MAX } from '@/lib/orders/draft';
import type { Zone } from '@/lib/orders/types';

export interface DeliveryValues {
  zoneId: string;
  pointId: string;
  /** Texto del selector de piso ('' = sin elegir). */
  floor: string;
  deliveryNote: string;
  note: string;
}

export interface DeliveryErrors {
  zone?: string | undefined;
  point?: string | undefined;
  floor?: string | undefined;
}

/** Zona → punto → piso (si el punto tiene pisos), más indicación de entrega y nota (D-039). */
export function DeliveryFields({
  zones,
  values,
  errors,
  disabled,
  onChange,
}: {
  zones: readonly Zone[];
  values: DeliveryValues;
  errors: DeliveryErrors;
  disabled?: boolean;
  onChange: (patch: Partial<DeliveryValues>) => void;
}) {
  const zone = zones.find((z) => z.id === values.zoneId);
  const point = zone?.points.find((p) => p.id === values.pointId);
  const floors = point?.floors ?? null;

  return (
    <div className="grid gap-4">
      <FormField id="zone" label="Zona" error={errors.zone}>
        {(control) => (
          <Select
            {...control}
            disabled={disabled}
            value={values.zoneId}
            onChange={(e) =>
              onChange({ zoneId: e.target.value, pointId: '', floor: '' })
            }
          >
            <option value="">Elige una zona</option>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      <FormField
        id="point"
        label="Punto de entrega"
        error={errors.point}
        {...(point?.hint ? { hint: point.hint } : {})}
      >
        {(control) => (
          <Select
            {...control}
            disabled={disabled || !zone}
            value={values.pointId}
            onChange={(e) => onChange({ pointId: e.target.value, floor: '' })}
          >
            <option value="">Elige un punto</option>
            {zone?.points.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        )}
      </FormField>

      {floors !== null ? (
        <FormField id="floor" label="Piso" error={errors.floor}>
          {(control) => (
            <Select
              {...control}
              disabled={disabled}
              value={values.floor}
              onChange={(e) => onChange({ floor: e.target.value })}
            >
              <option value="">Elige un piso</option>
              {Array.from({ length: floors }, (_, i) => i + 1).map((n) => (
                <option key={n} value={String(n)}>
                  Piso {n}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      ) : null}

      <FormField
        id="delivery-note"
        label="Indicación de entrega (opcional)"
        hint={`${values.deliveryNote.length}/${NOTE_MAX}`}
      >
        {(control) => (
          <Input
            {...control}
            disabled={disabled}
            maxLength={NOTE_MAX}
            placeholder="Junto a la entrada del salón 302"
            value={values.deliveryNote}
            onChange={(e) => onChange({ deliveryNote: e.target.value })}
          />
        )}
      </FormField>

      <FormField
        id="kitchen-note"
        label="Nota para la cocina (opcional)"
        hint={`${values.note.length}/${NOTE_MAX}`}
      >
        {(control) => (
          <Input
            {...control}
            disabled={disabled}
            maxLength={NOTE_MAX}
            placeholder="Sin azúcar"
            value={values.note}
            onChange={(e) => onChange({ note: e.target.value })}
          />
        )}
      </FormField>
    </div>
  );
}
