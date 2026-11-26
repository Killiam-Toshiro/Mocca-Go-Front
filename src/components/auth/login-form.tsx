'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ErrorAlert } from '@/components/auth/error-alert';
import { FormField } from '@/components/form-field';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { describeApiError } from '@/lib/api/errors';
import { requestJson } from '@/lib/api/json';
import { resolveNext } from '@/lib/auth/safe-next';
import { loginSchema, toLoginBody, type LoginValues } from '@/lib/auth/schemas';
import type { SessionUser } from '@/lib/auth/types';
import { navigate } from '@/lib/browser';

export function LoginForm({
  next,
  expired = false,
  registered = false,
}: {
  /** Destino pedido en la URL; solo se respeta si es interno y el rol puede entrar. */
  next?: string | undefined;
  expired?: boolean;
  registered?: boolean;
}) {
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
  });
  const { errors } = form.formState;

  const login = useMutation({
    mutationFn: (values: LoginValues) =>
      requestJson<{ user: SessionUser; expiresAt: number }>('/api/auth/login', {
        body: toLoginBody(values),
      }),
    onSuccess: ({ user }) => navigate(resolveNext(next, user.role)),
    onError: (error) => {
      setServerErrors(describeApiError(error));
      // Se conserva lo escrito en «usuario»; la contraseña se vuelve a pedir.
      form.resetField('password');
      form.setFocus('password');
    },
  });

  const busy = login.isPending || login.isSuccess;

  return (
    <form
      noValidate
      // Sin JavaScript el navegador enviaría el formulario: con POST los datos no viajan en la URL.
      method="post"
      className="grid gap-4"
      onSubmit={form.handleSubmit((values) => {
        setServerErrors([]);
        login.mutate(values);
      })}
    >
      {expired ? (
        <Alert role="status">Tu sesión venció. Inicia sesión de nuevo.</Alert>
      ) : null}
      {registered ? (
        <Alert role="status">
          Tu cuenta fue creada. Inicia sesión para continuar.
        </Alert>
      ) : null}
      <ErrorAlert messages={serverErrors} />

      <FormField
        id="identifier"
        label="Usuario o correo"
        error={errors.identifier?.message}
      >
        {(control) => (
          <Input
            {...control}
            {...form.register('identifier')}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
          />
        )}
      </FormField>

      <FormField
        id="password"
        label="Contraseña"
        error={errors.password?.message}
      >
        {(control) => (
          <PasswordInput
            {...control}
            {...form.register('password')}
            autoComplete="current-password"
          />
        )}
      </FormField>

      <Button type="submit" disabled={busy}>
        {busy ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden />
            Ingresando…
          </>
        ) : (
          'Ingresar'
        )}
      </Button>
    </form>
  );
}
