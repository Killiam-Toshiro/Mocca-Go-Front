import Link from 'next/link';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { ROLE_HOME } from '@/lib/auth/roles';
import { getSession } from '@/lib/server/session';

/** Portada mínima (el incremento 2 la convierte en el menú). */
export default async function HomePage() {
  const session = await getSession();
  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-4">
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="text-2xl">
            <h1>Mocca Go</h1>
          </CardTitle>
          <CardDescription>
            Café y snacks a domicilio dentro del campus de Icesi.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {session.status === 'ok' ? (
            <Button asChild className="sm:col-span-2">
              <Link href={ROLE_HOME[session.user.role]}>Ir a mi panel</Link>
            </Button>
          ) : (
            <>
              <Button asChild>
                <Link href="/login">Ingresar</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href="/registro">Crear cuenta</Link>
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
