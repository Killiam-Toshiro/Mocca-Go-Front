'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ErrorAlert } from '@/components/auth/error-alert';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  changedUserFields,
  editSchema,
  editValuesOf,
  nameMaxOf,
  type EditValues,
} from '@/lib/users/schemas';
import type { User } from '@/lib/users/types';
import { useUpdateUser } from '@/lib/users/use-update-user';

/** Editar usuario, nombre y celular (DP-04): solo se envía lo que cambió. Un cliente no edita usuario ni correo. */
export function EditUserForm({
  user,
  onSaved,
  onMissing,
}: {
  user: User;
  onSaved: (user: User) => void;
  onMissing: (messages: string[]) => void;
}) {
  const customer = user.role === 'cliente';
  const original = editValuesOf(user);
  const schema = useMemo(() => editSchema(user), [user]);
  const form = useForm<EditValues>({
    resolver: zodResolver(schema),
    defaultValues: original,
  });
  const { errors } = form.formState;
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const notice = useRef<HTMLParagraphElement>(null);

  const update = useUpdateUser({
    onDone: (saved) => {
      setServerErrors([]);
      form.reset(editValuesOf(saved));
      setSavedAt(Date.now());
      onSaved(saved);
    },
    onFail: (error) => {
      if (error.kind === 'missing') return onMissing(error.messages);
      if (error.fields.username)
        form.setError('username', { message: error.fields.username });
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
      changedUserFields(user, {
        username: watched.username ?? original.username,
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
      aria-label="Editar datos"
      className="grid gap-4"
      onChange={() => setSavedAt(null)}
      onSubmit={form.handleSubmit((values) => {
        setServerErrors([]);
        setSavedAt(null);
        void update.run(user, changedUserFields(user, values));
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
          Guardamos los cambios.
        </p>
      ) : null}

      {customer ? (
        <dl className="grid gap-1 text-sm">
          <dt className="font-medium">Correo</dt>
          <dd className="break-words text-muted-foreground">{user.email}</dd>
          <p className="text-muted-foreground">
            El correo y el usuario de un cliente no se editan.
          </p>
        </dl>
      ) : (
        <FormField
          id="edit-username"
          label="Usuario"
          error={errors.username?.message}
        >
          {(control) => (
            <Input
              {...control}
              {...form.register('username')}
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
            />
          )}
        </FormField>
      )}
      <FormField
        id="edit-fullName"
        label="Nombre completo"
        hint={`De 2 a ${nameMaxOf(user)} caracteres.`}
        error={errors.fullName?.message}
      >
        {(control) => (
          <Input
            {...control}
            {...form.register('fullName')}
            autoComplete="off"
          />
        )}
      </FormField>
      <FormField id="edit-phone" label="Celular" error={errors.phone?.message}>
        {(control) => (
          <Input
            {...control}
            {...form.register('phone')}
            type="tel"
            inputMode="tel"
            autoComplete="off"
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
