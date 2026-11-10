export const ROLES = ['cliente', 'operador', 'repartidor', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export function isRole(value: unknown): value is Role {
  return (
    typeof value === 'string' && (ROLES as readonly string[]).includes(value)
  );
}

/** Home de cada rol (D-011). */
export const ROLE_HOME: Record<Role, string> = {
  cliente: '/cliente',
  operador: '/operador',
  repartidor: '/repartidor',
  admin: '/admin',
};

/** Prefijos que puede visitar cada rol. El admin solo tiene `/admin` por ahora (D-012). */
export const ROLE_PREFIXES: Record<Role, readonly string[]> = {
  cliente: ['/cliente'],
  operador: ['/operador'],
  repartidor: ['/repartidor'],
  admin: ['/admin'],
};

function matchesPrefix(pathname: string, prefix: string): boolean {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/** Rol dueño de la ruta, o `null` si es pública o no pertenece a ningún panel. */
export function roleOwningPath(pathname: string): Role | null {
  for (const role of ROLES) {
    if (ROLE_PREFIXES[role].some((prefix) => matchesPrefix(pathname, prefix)))
      return role;
  }
  return null;
}

export function canAccess(role: Role, pathname: string): boolean {
  return ROLE_PREFIXES[role].some((prefix) => matchesPrefix(pathname, prefix));
}

/** ¿Es una ruta privada (de algún panel)? */
export function isPrivatePath(pathname: string): boolean {
  return roleOwningPath(pathname) !== null;
}
