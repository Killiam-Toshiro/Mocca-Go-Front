import * as React from 'react';
import { cn } from '@/lib/utils';

/** `<select>` nativo con el aspecto de `Input` (accesible y cómodo en móvil). */
function Select({ className, ...props }: React.ComponentProps<'select'>) {
  return (
    <select
      data-slot="select"
      className={cn(
        'flex h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 py-2 text-base shadow-xs outline-none md:text-sm',
        'focus-visible:ring-2 focus-visible:ring-ring',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'aria-invalid:border-destructive aria-invalid:ring-destructive/30',
        className,
      )}
      {...props}
    />
  );
}

export { Select };
