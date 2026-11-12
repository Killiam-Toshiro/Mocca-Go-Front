'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ErrorAlert } from '@/components/auth/error-alert';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  ZONE_NAME_MAX,
  zoneSchema,
  type ZoneFormValues,
} from '@/lib/zones/schemas';
import type { AdminZone } from '@/lib/zones/types';
import { useCreateZone, useUpdateZone } from '@/lib/zones/use-zone-actions';

/** Crear una zona o renombrarla (DP-02): solo se envía el nombre si cambió. */
export function ZoneForm({
  zone,
  onSaved,
  onMissing,
}: {
  zone?: AdminZone;
  onSaved: (zone: AdminZone, created: boolean) => void;
  onMissing: (messages: string[]) => void;
}) {
  const form = useForm<ZoneFormValues>({
    resolver: zodResolver(zoneSchema),
    defaultValues: { name: zone?.name ?? '' },
  });
  const { errors } = form.formState;
  const name = useWatch({ control: form.control, name: 'name' });
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [retry, setRetry] = useState(false);

  const handlers = {
    onFail: (error: import('@/lib/zones/errors').ZoneError) => {
      if (error.kind === 'missing') return onMissing(error.messages);
      if (error.fields.name)
        form.setError('name', { message: error.fields.name });
      setServerErrors([
        ...error.messages,
        ...(error.fields.hint ? [error.fields.hint] : []),
      ]);
      if (error.kind === 'ambiguous') setRetry(true);
    },
  };
  const create = useCreateZone({
    ...handlers,
    onDone: (saved) => onSaved(saved, true),
  });
  const update = useUpdateZone({
    ...handlers,
    onDone: (saved) => onSaved(saved, false),
  });
  const pending = create.pending || update.pending;
  const dirty = zone ? name.trim() !== zone.name : true;

  return (
    <form
      noValidate
      method="post"
      aria-label={zone ? 'Renombrar zona' : 'Crear zona'}
      className="grid gap-4"
      onSubmit={form.handleSubmit((values) => {
        setServerErrors([]);
        setRetry(false);
        const trimmed = values.name.trim();
        if (zone) void update.run({ zone, body: { name: trimmed } });
        else void create.run({ name: trimmed });
      })}
    >
      <ErrorAlert messages={serverErrors} />
      <FormField
        id="zone-name"
        label="Nombre de la zona"
        hint={`${String(name.length)}/${String(ZONE_NAME_MAX)}`}
        error={errors.name?.message}
      >
        {(control) => (
          <Input
            {...control}
            {...form.register('name')}
            autoComplete="off"
            maxLength={ZONE_NAME_MAX}
            autoFocus
          />
        )}
      </FormField>
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
        ) : zone ? (
          'Guardar cambios'
        ) : (
          'Crear zona'
        )}
      </Button>
    </form>
  );
}
