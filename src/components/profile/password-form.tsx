'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ErrorAlert } from '@/components/auth/error-alert';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { passwordSchema, type PasswordValues } from '@/lib/profile/schemas';
import { useChangePassword } from '@/lib/profile/use-change-password';

const EMPTY: PasswordValues = {
  currentPassword: '',
  newPassword: '',
  repeat: '',
};

/**
 * Cambiar contraseña (DP-08). Las contraseñas viven solo en este formulario: se vacían al terminar
 * y tras un error de red. El cambio no cierra la sesión actual; el back cierra las demás.
 */
export function PasswordForm() {
  const form = useForm<PasswordValues>({
    resolver: zodResolver(passwordSchema),
    defaultValues: EMPTY,
  });
  const { errors } = form.formState;
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [doneAt, setDoneAt] = useState<number | null>(null);
  const notice = useRef<HTMLParagraphElement>(null);

  const change = useChangePassword({
    onDone: () => {
      setServerErrors([]);
      form.reset(EMPTY);
      setDoneAt(Date.now());
    },
    onFail: (error) => {
      if (error.kind === 'current') {
        form.resetField('currentPassword');
        form.setError('currentPassword', { message: error.messages[0] });
        form.setFocus('currentPassword');
      } else if (error.kind === 'same') {
        form.setError('newPassword', { message: error.messages[0] });
        form.setFocus('newPassword');
      } else {
        if (error.kind === 'ambiguous') form.reset(EMPTY);
        setServerErrors(error.messages);
      }
    },
  });

  useEffect(() => {
    if (doneAt) notice.current?.focus();
  }, [doneAt]);

  return (
    <form
      noValidate
      // Sin JavaScript el navegador enviaría el formulario: con POST la contraseña no viaja en la URL.
      method="post"
      aria-label="Cambiar contraseña"
      className="grid gap-4"
      onSubmit={form.handleSubmit((values) => {
        setServerErrors([]);
        setDoneAt(null);
        void change.run(values.currentPassword, values.newPassword);
      })}
    >
      <ErrorAlert messages={serverErrors} />
      {doneAt ? (
        <p
          ref={notice}
          role="status"
          tabIndex={-1}
          className="rounded-lg border bg-card px-4 py-3 text-sm font-medium outline-none"
        >
          Cambiamos tu contraseña. Cerramos tus otras sesiones; esta sigue
          abierta.
        </p>
      ) : null}

      <FormField
        id="currentPassword"
        label="Contraseña actual"
        hint="Si fallas varias veces, la cuenta se bloquea 15 minutos."
        error={errors.currentPassword?.message}
      >
        {(control) => (
          <PasswordInput
            {...control}
            {...form.register('currentPassword')}
            autoComplete="current-password"
          />
        )}
      </FormField>

      <FormField
        id="newPassword"
        label="Contraseña nueva"
        hint="Entre 12 y 128 caracteres, distinta de la actual."
        error={errors.newPassword?.message}
      >
        {(control) => (
          <PasswordInput
            {...control}
            {...form.register('newPassword')}
            autoComplete="new-password"
          />
        )}
      </FormField>

      <FormField
        id="repeat"
        label="Repite la contraseña nueva"
        error={errors.repeat?.message}
      >
        {(control) => (
          <PasswordInput
            {...control}
            {...form.register('repeat')}
            autoComplete="new-password"
          />
        )}
      </FormField>

      <Button
        type="submit"
        className="min-h-12 justify-self-start"
        disabled={change.pending}
      >
        {change.pending ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden />
            Cambiando…
          </>
        ) : (
          'Cambiar contraseña'
        )}
      </Button>
    </form>
  );
}
