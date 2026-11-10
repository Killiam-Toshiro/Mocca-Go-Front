'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';
import { LogOut } from 'lucide-react';
import { MobileNav } from '@/components/mobile-nav';
import { NavList } from '@/components/nav-list';
import { useSession } from '@/components/providers/session-provider';
import { Button } from '@/components/ui/button';
import { NAV, ROLE_LABEL } from '@/lib/auth/nav';
import { ROLE_HOME } from '@/lib/auth/roles';
import { Logo } from '@/components/logo';
import { useDisplayName } from '@/lib/auth/use-display-name';
import { useLogout } from '@/lib/auth/use-logout';

/** Marco de todas las pantallas con sesión: marca, navegación del rol, usuario y «Salir». */
export function AppShell({ children }: { children: ReactNode }) {
  const { user } = useSession();
  const pathname = usePathname();
  const logout = useLogout();
  const name = useDisplayName();
  const items = NAV[user.role];

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[16rem_1fr]">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:shadow"
      >
        Saltar al contenido
      </a>

      <aside className="hidden border-r bg-secondary md:block">
        <div className="sticky top-0 grid gap-6 p-4">
          <Link
            href={ROLE_HOME[user.role]}
            aria-label="Mocca Go"
            className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Logo />
          </Link>
          <nav aria-label="Principal">
            <NavList items={items} pathname={pathname} />
          </nav>
        </div>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-card px-4">
          <MobileNav items={items} pathname={pathname} />
          <Link
            href={ROLE_HOME[user.role]}
            aria-label="Mocca Go"
            className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          >
            <Logo iconClassName="size-8" textClassName="text-lg" />
          </Link>
          <div className="ml-auto flex min-w-0 items-center gap-3">
            <p className="min-w-0 text-right text-sm leading-tight">
              <span className="block max-w-40 truncate font-medium sm:max-w-64">
                {name ?? 'Mi cuenta'}
              </span>
              <span className="block text-xs text-muted-foreground">
                {ROLE_LABEL[user.role]}
              </span>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={logout.isPending}
              onClick={() => logout.mutate()}
            >
              <LogOut aria-hidden />
              Salir
            </Button>
          </div>
        </header>
        <main
          id="contenido"
          tabIndex={-1}
          className="min-w-0 flex-1 p-4 outline-none md:p-6"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
