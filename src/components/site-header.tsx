import Link from 'next/link';
import { Logo } from '@/components/logo';
import { Button } from '@/components/ui/button';
import { ROLE_HOME, type Role } from '@/lib/auth/roles';

/** Cabecera de las páginas públicas: marca y acceso (o «Ir a mi panel» con sesión). */
export function SiteHeader({ role }: { role: Role | null }) {
  return (
    <header className="border-b bg-card">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
        <Link href="/" aria-label="Mocca Go, inicio">
          <Logo />
        </Link>
        <nav aria-label="Cuenta" className="flex items-center gap-2">
          {role ? (
            <Button asChild size="sm">
              <Link href={ROLE_HOME[role]}>Ir a mi panel</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="outline" size="sm">
                <Link href="/login">Ingresar</Link>
              </Button>
              <Button asChild size="sm">
                <Link href="/registro">Crear cuenta</Link>
              </Button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}
