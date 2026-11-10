import {
  Ban,
  CircleAlert,
  CircleCheck,
  EyeOff,
  PackageMinus,
  PackageX,
} from 'lucide-react';
import {
  availability,
  type AvailabilityKey,
} from '@/lib/inventory/availability';
import type { StaffProduct } from '@/lib/inventory/types';
import { cn } from '@/lib/utils';

const ICON = {
  disponible: CircleCheck,
  agotado: Ban,
  sin_saldo: PackageX,
  inactivo: EyeOff,
  falta_componente: PackageMinus,
  no_disponible: CircleAlert,
} satisfies Record<AvailabilityKey, typeof Ban>;

/** Estado de disponibilidad en palabras, con ícono (D-066, D-046). */
export function StatusBadge({
  product,
  className,
}: {
  product: Parameters<typeof availability>[0] & Pick<StaffProduct, 'id'>;
  className?: string;
}) {
  const { key, label } = availability(product);
  const Icon = ICON[key];
  const good = key === 'disponible';
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm font-semibold whitespace-nowrap',
        good
          ? 'border-transparent bg-secondary text-secondary-foreground'
          : key === 'inactivo'
            ? 'border-input bg-card text-muted-foreground'
            : 'border-destructive bg-card text-destructive',
        className,
      )}
    >
      <Icon className="size-4" aria-hidden />
      {label}
    </span>
  );
}
