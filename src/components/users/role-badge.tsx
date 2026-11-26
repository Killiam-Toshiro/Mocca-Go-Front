import { Bike, ChefHat, ShieldCheck, User as UserIcon } from 'lucide-react';
import { roleLabel } from '@/lib/users/roles';
import type { UserRole } from '@/lib/users/types';

const ICONS = {
  admin: ShieldCheck,
  operador: ChefHat,
  repartidor: Bike,
  cliente: UserIcon,
} as const;

/** Rol con texto + ícono (D-046). */
export function RoleBadge({ role }: { role: UserRole }) {
  const Icon = ICONS[role];
  return (
    <span className="inline-flex items-center gap-1.5 justify-self-start rounded-full border border-input bg-card px-2.5 py-1 text-sm font-medium whitespace-nowrap">
      <Icon className="size-4" aria-hidden />
      {roleLabel(role)}
    </span>
  );
}
