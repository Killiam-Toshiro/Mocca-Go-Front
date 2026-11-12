import { Eye, EyeOff } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Estado en palabras con ícono, nunca solo color (D-046). */
export function ActiveBadge({
  active,
  feminine = false,
}: {
  active: boolean;
  feminine?: boolean;
}) {
  const Icon = active ? Eye : EyeOff;
  const label = active
    ? feminine
      ? 'Activa'
      : 'Activo'
    : feminine
      ? 'Inactiva'
      : 'Inactivo';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        active
          ? 'bg-secondary text-brand-strong'
          : 'border bg-card text-muted-foreground',
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {label}
    </span>
  );
}
