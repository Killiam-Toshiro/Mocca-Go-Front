import {
  Ban,
  Bike,
  ChefHat,
  CircleCheck,
  CircleX,
  ClipboardCheck,
  PackageCheck,
  type LucideIcon,
} from 'lucide-react';
import {
  statusInfo,
  type StatusIcon,
  type StatusTone,
} from '@/lib/orders/status';
import { cn } from '@/lib/utils';

const ICONS: Record<StatusIcon, LucideIcon> = {
  recibido: ClipboardCheck,
  preparacion: ChefHat,
  listo: PackageCheck,
  camino: Bike,
  entregado: CircleCheck,
  'no-entregado': CircleX,
  cancelado: Ban,
};

const TONES: Record<StatusTone, string> = {
  info: 'bg-secondary text-secondary-foreground',
  progress: 'bg-primary text-primary-foreground',
  success: 'bg-secondary text-brand-strong',
  danger: 'border border-destructive bg-card text-destructive',
};

/** Estado del pedido con ícono y texto: nunca solo color (D-046). */
export function StatusBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  const info = statusInfo(status);
  const Icon = ICONS[info.icon];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap',
        TONES[info.tone],
        className,
      )}
    >
      <Icon className="size-3.5" aria-hidden />
      {info.label}
    </span>
  );
}
