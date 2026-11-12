'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ErrorAlert } from '@/components/auth/error-alert';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { ZoneError } from '@/lib/zones/errors';
import {
  changedPointFields,
  createPointBody,
  FLOORS_MAX,
  HINT_MAX,
  POINT_NAME_MAX,
  pointSchema,
  pointValuesOf,
  type PointFormValues,
} from '@/lib/zones/schemas';
import type { AdminPoint, AdminZone } from '@/lib/zones/types';
import { useCreatePoint, useUpdatePoint } from '@/lib/zones/use-zone-actions';

/**
 * Crear o editar un punto (DP-08, DP-09): casilla «tiene pisos», selector de zona para crear o
 * mover, y en edición solo se envía lo modificado (indicación vacía y «sin pisos» van como `null`).
 */
export function PointForm({
  point,
  zoneId,
  zones,
  onSaved,
  onMissing,
}: {
  point?: AdminPoint;
  /** Zona preseleccionada al crear. */
  zoneId?: string;
  zones: readonly AdminZone[];
  onSaved: (point: AdminPoint, created: boolean) => void;
  onMissing: (messages: string[]) => void;
}) {
  const defaults: PointFormValues = point
    ? pointValuesOf(point)
    : {
        zoneId: zoneId ?? zones[0]?.id ?? '',
        name: '',
        hint: '',
        hasFloors: false,
        floors: '',
      };
  const form = useForm<PointFormValues>({
    resolver: zodResolver(pointSchema),
    defaultValues: defaults,
  });
  const { errors } = form.formState;
  const watched = {
    ...defaults,
    ...(useWatch({ control: form.control }) as Partial<PointFormValues>),
  };
  const body = point ? changedPointFields(point, watched) : null;
  const dirty = body ? Object.keys(body).length > 0 : true;
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [retry, setRetry] = useState(false);

  const handlers = {
    onFail: (error: ZoneError) => {
      if (error.kind === 'missing') {
        // Una zona destino inexistente es un error del formulario; un punto inexistente, del listado.
        if (error.messages.some((m) => /zona/i.test(m)))
          return setServerErrors(error.messages);
        return onMissing(error.messages);
      }
      const f = error.fields;
      if (f.name) form.setError('name', { message: f.name });
      if (f.hint) form.setError('hint', { message: f.hint });
      if (f.floors) form.setError('floors', { message: f.floors });
      if (f.zoneId) form.setError('zoneId', { message: f.zoneId });
      setServerErrors(error.messages);
      if (error.kind === 'ambiguous') setRetry(true);
    },
  };
  const create = useCreatePoint({
    ...handlers,
    onDone: (saved) => onSaved(saved, true),
  });
  const update = useUpdatePoint({
    ...handlers,
    onDone: (saved) => onSaved(saved, false),
  });
  const pending = create.pending || update.pending;

  return (
    <form
      noValidate
      method="post"
      aria-label={point ? 'Editar punto' : 'Agregar punto'}
      className="grid gap-4"
      onSubmit={form.handleSubmit((values) => {
        setServerErrors([]);
        setRetry(false);
        if (point)
          void update.run({ point, body: changedPointFields(point, values) });
        else void create.run(createPointBody(values));
      })}
    >
      <ErrorAlert messages={serverErrors} />
      <FormField
        id="point-zone"
        label="Zona"
        hint={point ? 'Cambiarla mueve el punto a otra zona.' : undefined}
        error={errors.zoneId?.message}
      >
        {(control) => (
          <Select {...control} {...form.register('zoneId')}>
            {zones.map((z) => (
              <option key={z.id} value={z.id}>
                {z.name}
                {z.active ? '' : ' (inactiva)'}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField
        id="point-name"
        label="Nombre del punto"
        hint="No puede repetirse en ninguna zona."
        error={errors.name?.message}
      >
        {(control) => (
          <Input
            {...control}
            {...form.register('name')}
            autoComplete="off"
            maxLength={POINT_NAME_MAX}
            autoFocus
          />
        )}
      </FormField>
      <FormField
        id="point-hint"
        label="Indicación"
        hint={`Opcional. ${String(watched.hint.length)}/${String(HINT_MAX)} · Déjala vacía para borrarla.`}
        error={errors.hint?.message}
      >
        {(control) => (
          <Input
            {...control}
            {...form.register('hint')}
            autoComplete="off"
            maxLength={HINT_MAX}
          />
        )}
      </FormField>
      <div className="flex items-center gap-3">
        <input
          id="point-has-floors"
          type="checkbox"
          className="size-6 accent-primary"
          {...form.register('hasFloors')}
        />
        <Label htmlFor="point-has-floors">Este lugar tiene pisos</Label>
      </div>
      {watched.hasFloors ? (
        <FormField
          id="point-floors"
          label="Número de pisos"
          hint={`De 1 a ${String(FLOORS_MAX)}.`}
          error={errors.floors?.message}
        >
          {(control) => (
            <Input
              {...control}
              {...form.register('floors')}
              inputMode="numeric"
              autoComplete="off"
            />
          )}
        </FormField>
      ) : null}
      <Button
        type="submit"
        className="min-h-12 justify-self-start"
        disabled={pending || !dirty}
      >
        {pending ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden />
            Guardando…
          </>
        ) : retry ? (
          'Reintentar'
        ) : point ? (
          'Guardar cambios'
        ) : (
          'Agregar punto'
        )}
      </Button>
    </form>
  );
}
