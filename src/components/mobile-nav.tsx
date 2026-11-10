'use client';

import { Menu, X } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { NavList } from '@/components/nav-list';
import { Button } from '@/components/ui/button';
import type { NavItem } from '@/lib/auth/nav';

/**
 * Menú lateral para pantallas pequeñas. Usa `<dialog>`: el navegador aporta el
 * foco atrapado, el cierre con Escape y el fondo, sin dependencias.
 */
export function MobileNav({
  items,
  pathname,
}: {
  items: NavItem[];
  pathname: string;
}) {
  // El menú está abierto «para una ruta»: al navegar a otra, se cierra solo.
  const [openFor, setOpenFor] = useState<string | null>(null);
  const open = openFor === pathname;
  const setOpen = (value: boolean) => setOpenFor(value ? pathname : null);
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="md:hidden"
        aria-label="Abrir menú"
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu aria-hidden />
      </Button>
      <dialog
        ref={dialog}
        aria-label="Menú"
        onClose={() => setOpen(false)}
        onClick={(event) => {
          // Un clic sobre el fondo (el propio <dialog>) lo cierra.
          if (event.target === event.currentTarget) setOpen(false);
        }}
        className="fixed inset-y-0 left-0 m-0 h-dvh max-h-none w-72 max-w-[85vw] border-r bg-background p-4 text-foreground backdrop:bg-black/50 open:flex open:flex-col md:hidden"
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-lg font-semibold">Mocca Go</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Cerrar menú"
            onClick={() => setOpen(false)}
          >
            <X aria-hidden />
          </Button>
        </div>
        <nav aria-label="Navegación móvil">
          <NavList
            items={items}
            pathname={pathname}
            onNavigate={() => setOpen(false)}
          />
        </nav>
      </dialog>
    </>
  );
}
