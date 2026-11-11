import { ROLE_LABEL } from '@/lib/auth/nav';
import type { StaffRole, UserRole } from './types';

export const STAFF_ROLES: readonly StaffRole[] = [
  'admin',
  'operador',
  'repartidor',
];

export const roleLabel = (role: UserRole): string => ROLE_LABEL[role];

/** Filtro de la lista: «Personal» es la vista por defecto (DP-02). */
export type RoleFilter =
  'personal' | 'todos' | 'admin' | 'operador' | 'repartidor' | 'cliente';

export const ROLE_FILTERS: { value: RoleFilter; label: string }[] = [
  { value: 'personal', label: 'Personal' },
  { value: 'todos', label: 'Todos' },
  { value: 'admin', label: 'Administradores' },
  { value: 'operador', label: 'Operadores' },
  { value: 'repartidor', label: 'Repartidores' },
  { value: 'cliente', label: 'Clientes' },
];

/** Valor de `role` en `GET /users`, o `null` si no se filtra (los repetidos no se envían). */
export function roleParam(filter: RoleFilter): string | null {
  if (filter === 'todos') return null;
  if (filter === 'personal') return STAFF_ROLES.join(',');
  return filter;
}
