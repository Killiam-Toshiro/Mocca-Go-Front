import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { LoginForm } from '@/components/auth/login-form';

export const metadata: Metadata = { title: 'Ingresar' };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? value[0] : value;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  return (
    <AuthCard
      title="Ingresar"
      description="Entra con tu usuario o con el correo de tu cuenta."
      footer={
        <>
          ¿Aún no tienes cuenta?{' '}
          <Link
            href="/registro"
            className="font-semibold text-brand-strong underline underline-offset-4"
          >
            Crear cuenta
          </Link>
        </>
      }
    >
      <LoginForm
        next={first(params.next)}
        expired={first(params.expired) === '1'}
        registered={first(params.registered) === '1'}
      />
    </AuthCard>
  );
}
