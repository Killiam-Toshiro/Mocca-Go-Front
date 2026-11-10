import type { Metadata } from 'next';
import { MenuView } from '@/components/menu/menu-view';
import { SiteHeader } from '@/components/site-header';
import { getSession } from '@/lib/server/session';

export const metadata: Metadata = {
  title: { absolute: 'Mocca Go · Menú' },
  description: 'Café y snacks a domicilio dentro del campus de Icesi.',
};

/** Menú público: cualquiera puede mirarlo y armar su carrito sin cuenta (D-028). */
export default async function HomePage() {
  const session = await getSession();
  const role = session.status === 'ok' ? session.user.role : null;
  return (
    <>
      <SiteHeader role={role} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <p className="mb-4 text-muted-foreground">
          Café y snacks a domicilio dentro del campus de Icesi.
        </p>
        <MenuView
          audience={
            role === null
              ? 'visitante'
              : role === 'cliente'
                ? 'cliente'
                : 'personal'
          }
        />
      </main>
    </>
  );
}
