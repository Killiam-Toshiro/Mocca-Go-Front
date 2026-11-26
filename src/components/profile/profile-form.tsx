'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ErrorAlert } from '@/components/auth/error-alert';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  changedFields,
  profileSchema,
  type ProfileValues,
} from '@/lib/profile/schemas';
import type { Profile } from '@/lib/profile/types';
import { useUpdateProfile } from '@/lib/profile/use-update-profile';

/** Editar nombre y celular (DP-06/07/09): solo se envía lo que cambió y el valor guardado es el del back. */
export function ProfileForm({ profile }: { profile: Profile }) {
  const original: ProfileValues = {
    fullName: profile.fullName,
    phone: profile.phone,
  };
  const form = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: original,
  });
  const { errors } = form.formState;
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const notice = useRef<HTMLParagraphElement>(null);

  const update = useUpdateProfile({
    onDone: (saved) => {
      setServerErrors([]);
      form.reset({ fullName: saved.fullName, phone: saved.phone });
      setSavedAt(Date.now());
    },
    onFail: (error) => {
      if (error.fields.fullName)
        form.setError('fullName', { message: error.fields.fullName });
      if (error.fields.phone)
        form.setError('phone', { message: error.fields.phone });
      setServerErrors(error.messages);
    },
  });

  const watched = useWatch({ control: form.control });
  const dirty =
    Object.keys(
      changedFields(original, {
        fullName: watched.fullName ?? original.fullName,
        phone: watched.phone ?? original.phone,
      }),
    ).length > 0;

  useEffect(() => {
    if (savedAt) notice.current?.focus();
  }, [savedAt]);

  return (
    <form
      noValidate
      method="post"
      aria-label="Editar nombre y celular"
      className="grid gap-4"
      // Al volver a editar, el aviso de «guardado» ya no corresponde.
      onChange={() => setSavedAt(null)}
      onSubmit={form.handleSubmit((submitted) => {
        setServerErrors([]);
        setSavedAt(null);
        void update.run(original, submitted);
      })}
    >
      <ErrorAlert messages={serverErrors} />
      {savedAt ? (
        <p
          ref={notice}
          role="status"
          tabIndex={-1}
          className="rounded-lg border bg-card px-4 py-3 text-sm font-medium outline-none"
        >
          Guardamos tus cambios.
        </p>
      ) : null}

      <FormField
        id="fullName"
        label="Nombre completo"
        error={errors.fullName?.message}
      >
        {(control) => (
          <Input
            {...control}
            {...form.register('fullName')}
            autoComplete="name"
            disabled={update.pending}
          />
        )}
      </FormField>

      <FormField
        id="phone"
        label="Celular"
        hint="Lo guardamos con el indicativo del país, por ejemplo +573001234567."
        error={errors.phone?.message}
      >
        {(control) => (
          <Input
            {...control}
            {...form.register('phone')}
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            disabled={update.pending}
          />
        )}
      </FormField>

      <Button
        type="submit"
        className="min-h-12 justify-self-start"
        disabled={!dirty || update.pending}
      >
        {update.pending ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden />
            Guardando…
          </>
        ) : (
          'Guardar cambios'
        )}
      </Button>
    </form>
  );
}
