'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ErrorAlert } from '@/components/auth/error-alert';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { roleLabel, STAFF_ROLES } from '@/lib/users/roles';
import {
  changeRoleSchema,
  courierContactMissing,
  missingContact,
  type ChangeRoleValues,
} from '@/lib/users/schemas';
import type { StaffRole, User } from '@/lib/users/types';
import { useChangeRole } from '@/lib/users/use-change-role';
import { ServerNotice } from './server-notice';

/** Cambiar rol (DP-05): cierra las sesiones del usuario. A repartidor pide el contacto que falte. */
export function ChangeRoleForm({
  user,
  onChanged,
  onMissing,
}: {
  user: User;
  onChanged: (user: User) => void;
  onMissing: (messages: string[]) => void;
}) {
  const schema = useMemo(() => changeRoleSchema(user), [user]);
  const form = useForm<ChangeRoleValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      role: user.role as StaffRole,
      fullName: '',
      phone: '',
    },
  });
  const { errors } = form.formState;
  const role = useWatch({ control: form.control, name: 'role' });
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [conflict, setConflict] = useState<string[]>([]);

  const change = useChangeRole({
    onDone: (updated) => onChanged(updated),
    onFail: (error) => {
      if (error.kind === 'missing') return onMissing(error.messages);
      if (error.kind === 'conflict') return setConflict(error.messages);
      if (error.fields.fullName)
        form.setError('fullName', { message: error.fields.fullName });
      if (error.fields.phone)
        form.setError('phone', { message: error.fields.phone });
      setServerErrors(error.messages);
    },
  });
  const needsContact = courierContactMissing(user, role);

  return (
    <form
      noValidate
      method="post"
      aria-label="Cambiar rol"
      className="grid gap-4"
      onSubmit={form.handleSubmit((values) => {
        setServerErrors([]);
        setConflict([]);
        void change.run(user, values.role, missingContact(user, values));
      })}
    >
      <h3 className="font-semibold">Cambiar rol</h3>
      <p className="text-sm text-muted-foreground">
        Se cerrará su sesión y deberá iniciar sesión de nuevo.
      </p>
      <ErrorAlert messages={serverErrors} />
      <ServerNotice messages={conflict} onDismiss={() => setConflict([])} />
      <FormField id="role-new" label="Nuevo rol">
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
      {needsContact ? (
        <>
          <p className="text-sm text-muted-foreground">
            Un repartidor necesita nombre y celular guardados.
          </p>
          {!user.fullName ? (
            <FormField
              id="role-fullName"
              label="Nombre completo"
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
          ) : null}
          {!user.phone ? (
            <FormField
              id="role-phone"
              label="Celular"
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
          ) : null}
        </>
      ) : null}
      <Button
        type="submit"
        className="min-h-12 justify-self-start"
        disabled={role === user.role || change.pending}
      >
        {change.pending ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden />
            Cambiando…
          </>
        ) : (
          'Cambiar rol'
        )}
      </Button>
    </form>
  );
}
