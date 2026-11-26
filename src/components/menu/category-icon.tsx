import {
  CakeSlice,
  Coffee,
  Cookie,
  Croissant,
  CupSoda,
  Package,
  Sandwich,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const ICONS: Record<string, LucideIcon> = {
  combo: Package,
  cafe: Coffee,
  bebida: CupSoda,
  panaderia: Croissant,
  pasteleria: CakeSlice,
  snack: Sandwich,
};

/** Ícono por categoría, en lugar de foto, hasta que el back ofrezca imágenes (D-036). */
export function CategoryIcon({
  category,
  className,
}: {
  category: string;
  className?: string;
}) {
  const Icon = ICONS[category] ?? Cookie;
  return <Icon aria-hidden className={cn('size-6', className)} />;
}
