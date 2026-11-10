'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation } from '@tanstack/react-query';
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { ErrorAlert } from '@/components/auth/error-alert';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { describeApiError, isApiError } from '@/lib/api/errors';
import { requestJson } from '@/lib/api/json';
import { registerSchema, type RegisterValues } from '@/lib/auth/schemas';
import { navigate } from '@/lib/browser';

/** El registro no inicia sesión en el back (D-009): se hace un login automático después. */
async function registerAndLogin(
  values: RegisterValues,
): Promise<'logged-in' | 'created'> {
  await requestJson('/api/customers', { body: values });
  try {
    await requestJson('/api/auth/login', {
      body: { email: values.email, password: values.password },
    });
    return 'logged-in';
  } catch {
    return 'created';
  }
}

export function RegisterForm() {
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const form = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', fullName: '', phone: '' },
  });
  const { errors } = form.formState;

  const register = useMutation({
    mutationFn: (values: RegisterValues) => registerAndLogin(values),
    onSuccess: (result) =>
      navigate(result === 'logged-in' ? '/cliente' : '/login?registered=1'),
    onError: (error) => {
      if (isApiError(error) && error.status === 409) {
        // Correo repetido: el mensaje del servidor va bajo el campo correo.
        form.setError('email', {
          message: error.messages[0] ?? 'Este correo ya está registrado.',
        });
        form.setFocus('email');
      } else {
        setServerErrors(describeApiError(error));
      }
      form.resetField('password');
    },
  });

  const busy = register.isPending || register.isSuccess;

  return (
    <form
      noValidate
      // Sin JavaScript el navegador enviaría el formulario: con POST los datos no viajan en la URL.
      method="post"
      className="grid gap-4"
      onSubmit={form.handleSubmit((values) => {
        setServerErrors([]);
        register.mutate(values);
      })}
    >
      <ErrorAlert messages={serverErrors} />

      <FormField id="email" label="Correo" error={errors.email?.message}>
        {(control) => (
          <Input
            {...control}
            {...form.register('email')}
            type="email"
            autoComplete="email"
            autoCapitalize="none"
            spellCheck={false}
          />
        )}
      </FormField>

      <FormField
        id="password"
        label="Contraseña"
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
          />
        )}
      </FormField>

      <FormField id="phone" label="Celular" error={errors.phone?.message}>
        {(control) => (
          <Input
            {...control}
            {...form.register('phone')}
            type="tel"
            autoComplete="tel"
            inputMode="tel"
          />
        )}
      </FormField>

      <Button type="submit" disabled={busy}>
        {busy ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden />
            Creando cuenta…
          </>
        ) : (
          'Crear cuenta'
        )}
      </Button>
    </form>
  );
}
