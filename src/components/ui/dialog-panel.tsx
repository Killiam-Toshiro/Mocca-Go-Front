'use client';

import { X } from 'lucide-react';
import { useEffect, useId, useRef, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

/**
 * Panel modal sobre `<dialog>`: el navegador aporta el foco atrapado, el cierre con Escape
 * y devuelve el foco a quien lo abrió. Cuando está cerrado no renderiza el contenido, de modo
 * que cada apertura empieza de cero. Mismo patrón que `MobileNav`.
 */
export function DialogPanel({
  open,
  onClose,
  title,
  variant = 'side',
  className,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  /** `side`: panel lateral derecho · `center`: diálogo centrado. */
  variant?: 'side' | 'center';
  className?: string;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  // El fondo no se desplaza mientras hay un panel abierto.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // Un clic sobre el fondo (el propio <dialog>) lo cierra.
        if (event.target === event.currentTarget) onClose();
      }}
      className={cn(
        'm-0 max-h-none border bg-card p-0 text-card-foreground shadow-xl backdrop:bg-black/50',
        variant === 'side'
          ? 'fixed inset-y-0 right-0 h-dvh w-[26rem] max-w-full open:flex open:flex-col'
          : 'fixed inset-0 m-auto h-fit max-h-[90dvh] w-[min(32rem,calc(100%-2rem))] rounded-xl open:flex open:flex-col',
        className,
      )}
    >
      {open ? (
        <>
          <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
            <h2 id={titleId} className="text-lg font-semibold">
              {title}
            </h2>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Cerrar"
              onClick={onClose}
            >
              <X aria-hidden />
            </Button>
          </header>
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {children}
          </div>
        </>
      ) : null}
    </dialog>
  );
}
