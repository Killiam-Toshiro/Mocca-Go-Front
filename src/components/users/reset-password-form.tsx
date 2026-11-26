'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { ErrorAlert } from '@/components/auth/error-alert';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/ui/password-input';
import { GENERIC_PASSWORD } from '@/lib/users/generic-password';
import {
  resetPasswordSchema,
  type ResetPasswordValues,
} from '@/lib/users/schemas';
import type { User } from '@/lib/users/types';
import { useUpdateUser } from '@/lib/users/use-update-user';

/**
 * Restablecer contraseña (DP-04): el campo empieza vacío; «Usar clave genérica» lo rellena. Nunca se
 * aplica sola a una cuenta existente. Cierra las demás sesiones del usuario y reinicia su bloqueo.
 */
export function ResetPasswordForm({
  user,
  onMissing,
}: {
  user: User;
  onMissing: (messages: string[]) => void;
}) {
  const form = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: '' },
  });
  const { errors } = form.formState;
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [doneAt, setDoneAt] = useState<number | null>(null);
  const notice = useRef<HTMLParagraphElement>(null);

  const update = useUpdateUser({
    onDone: () => {
      setServerErrors([]);
      form.reset({ password: '' });
      setDoneAt(Date.now());
    },
    onFail: (error) => {
      if (error.kind === 'missing') return onMissing(error.messages);
      if (error.fields.password)
        form.setError('password', { message: error.fields.password });
      if (error.kind === 'ambiguous') form.reset({ password: '' });
      setServerErrors(error.messages);
    },
  });

  useEffect(() => {
    if (doneAt) notice.current?.focus();
  }, [doneAt]);

  return (
    <form
      noValidate
      method="post"
      aria-label="Restablecer contraseña"
      className="grid gap-4"
      onChange={() => setDoneAt(null)}
      onSubmit={form.handleSubmit((values) => {
        setServerErrors([]);
        setDoneAt(null);
        void update.run(user, { password: values.password });
      })}
    >
      <h3 className="font-semibold">Restablecer contraseña</h3>
      <p className="text-sm text-muted-foreground">
        Cerrará las sesiones de este usuario y reiniciará su bloqueo.
      </p>
      <ErrorAlert messages={serverErrors} />
      {doneAt ? (
        <p
          ref={notice}
          role="status"
          tabIndex={-1}
          className="rounded-lg border bg-card px-4 py-3 text-sm font-medium outline-none"
        >
          Restablecimos la contraseña de {user.email ?? user.username}. Pídele
          que la cambie
          {user.role === 'cliente' ? ' en «Mi perfil»' : ' en «Mi cuenta»'}.
        </p>
      ) : null}
      <FormField
        id="reset-password"
        label="Nueva contraseña"
        hint="Entre 12 y 128 caracteres."
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
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant="outline"
          className="min-h-12"
          onClick={() =>
            form.setValue('password', GENERIC_PASSWORD, {
              shouldValidate: true,
              shouldDirty: true,
            })
          }
        >
          Usar clave genérica
        </Button>
        <Button type="submit" className="min-h-12" disabled={update.pending}>
          {update.pending ? (
            <>
              <LoaderCircle className="animate-spin" aria-hidden />
              Restableciendo…
            </>
          ) : (
            'Restablecer contraseña'
          )}
        </Button>
      </div>
    </form>
  );
}
