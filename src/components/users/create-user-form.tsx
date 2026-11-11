'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ErrorAlert } from '@/components/auth/error-alert';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { Select } from '@/components/ui/select';
import { GENERIC_PASSWORD } from '@/lib/users/generic-password';
import { roleLabel, STAFF_ROLES } from '@/lib/users/roles';
import { createUserSchema, type CreateUserValues } from '@/lib/users/schemas';
import type { User } from '@/lib/users/types';
import { useCreateUser } from '@/lib/users/use-create-user';

const DEFAULTS: CreateUserValues = {
  username: '',
  role: 'operador',
  fullName: '',
  phone: '',
  password: GENERIC_PASSWORD,
};

/** Crear personal (DP-03): la contraseña viene con la clave genérica y su dueño debe cambiarla. */
export function CreateUserForm({
  onCreated,
}: {
  onCreated: (user: User) => void;
}) {
  const form = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: DEFAULTS,
  });
  const { errors } = form.formState;
  const role = useWatch({ control: form.control, name: 'role' });
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [retry, setRetry] = useState(false);

  const create = useCreateUser({
    onDone: (user) => onCreated(user),
    onFail: (error) => {
      if (error.fields.username)
        form.setError('username', { message: error.fields.username });
      if (error.fields.fullName)
        form.setError('fullName', { message: error.fields.fullName });
      if (error.fields.phone)
        form.setError('phone', { message: error.fields.phone });
      if (error.fields.password)
        form.setError('password', { message: error.fields.password });
      setServerErrors(error.messages);
      if (error.kind === 'ambiguous') {
        // Lo escrito se conserva; la contraseña vuelve a la clave genérica (DP-09).
        form.setValue('password', GENERIC_PASSWORD);
        setRetry(true);
      }
    },
  });
  const courier = role === 'repartidor';

  return (
    <form
      noValidate
      method="post"
      aria-label="Crear usuario"
      className="grid gap-4"
      onSubmit={form.handleSubmit((values) => {
        setServerErrors([]);
        setRetry(false);
        void create.run(values);
      })}
    >
      <ErrorAlert messages={serverErrors} />
      <FormField
        id="new-username"
        label="Usuario"
        hint="Minúsculas, números, punto, guion o guion bajo."
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
      <FormField id="new-role" label="Rol" error={errors.role?.message}>
        {(control) => (
          <Select {...control} {...form.register('role')}>
            {STAFF_ROLES.map((r) => (
              <option key={r} value={r}>
                {roleLabel(r)}
              </option>
            ))}
          </Select>
        )}
      </FormField>
      <FormField
        id="new-fullName"
        label={courier ? 'Nombre completo' : 'Nombre completo (opcional)'}
        hint={courier ? 'Obligatorio para un repartidor.' : undefined}
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
      <FormField
        id="new-phone"
        label={courier ? 'Celular' : 'Celular (opcional)'}
        hint={courier ? 'Obligatorio para un repartidor.' : undefined}
        error={errors.phone?.message}
      >
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
      <FormField
        id="new-password"
        label="Contraseña inicial"
        hint="Clave genérica inicial: pídele que la cambie en «Mi cuenta». Puedes escribir otra."
        error={errors.password?.message}
      >
        {(control) => (
          <PasswordInput
            {...control}
            {...form.register('password')}
            autoComplete="new-password"
          />
        )}
      </FormField>
      <Button
        type="submit"
        className="min-h-12 justify-self-start"
        disabled={create.pending}
      >
        {create.pending ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden />
            Creando…
          </>
        ) : retry ? (
          'Reintentar'
        ) : (
          'Crear usuario'
        )}
      </Button>
    </form>
  );
}
