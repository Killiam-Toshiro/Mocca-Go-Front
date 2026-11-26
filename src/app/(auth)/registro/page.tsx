import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthCard } from '@/components/auth/auth-card';
import { RegisterForm } from '@/components/auth/register-form';

export const metadata: Metadata = { title: 'Crear cuenta' };

export default function RegisterPage() {
  return (
    <AuthCard
      title="Crear cuenta"
      description="Regístrate para pedir café y snacks dentro del campus."
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link
            href="/login"
            className="font-semibold text-brand-strong underline underline-offset-4"
          >
            Ingresar
          </Link>
        </>
      }
    >
      <RegisterForm />
    </AuthCard>
  );
}
