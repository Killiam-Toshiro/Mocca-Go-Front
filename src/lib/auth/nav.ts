import { ROLE_HOME, type Role } from './roles';

export interface NavItem {
  href: string;
  label: string;
  /** Las secciones de incrementos futuros se muestran deshabilitadas. */
  enabled: boolean;
}

export const ROLE_LABEL: Record<Role, string> = {
  cliente: 'Cliente',
  operador: 'Operador',
  repartidor: 'Repartidor',
  admin: 'Administrador',
};

const soon = (href: string, label: string): NavItem => ({
  href,
  label,
  enabled: false,
});

/**
 * Navegación de cada rol. Solo «Inicio» existe en el incremento 1; el resto son
 * las secciones del handoff §2, deshabilitadas hasta su incremento.
 */
export const NAV: Record<Role, NavItem[]> = {
  cliente: [
    { href: ROLE_HOME.cliente, label: 'Inicio', enabled: true },
    { href: '/cliente/menu', label: 'Menú', enabled: true },
    { href: '/cliente/pedidos', label: 'Mis pedidos', enabled: true },
    soon('/cliente/perfil', 'Mi perfil'),
  ],
  operador: [
    { href: ROLE_HOME.operador, label: 'Inicio', enabled: true },
    { href: '/operador/cocina', label: 'Cocina', enabled: true },
    { href: '/operador/productos', label: 'Productos', enabled: true },
    { href: '/operador/inventario', label: 'Inventario', enabled: true },
  ],
  repartidor: [
    { href: ROLE_HOME.repartidor, label: 'Inicio', enabled: true },
    { href: '/repartidor/cola', label: 'Cola de despacho', enabled: true },
    { href: '/repartidor/rondas', label: 'Mis rondas', enabled: true },
  ],
  admin: [
    { href: ROLE_HOME.admin, label: 'Inicio', enabled: true },
    { href: '/admin/cocina', label: 'Cocina', enabled: true },
    { href: '/admin/inventario', label: 'Inventario', enabled: true },
    soon('/admin/metricas', 'Métricas'),
    soon('/admin/pedidos', 'Pedidos'),
    soon('/admin/catalogo', 'Catálogo'),
    soon('/admin/zonas', 'Zonas y puntos'),
    soon('/admin/usuarios', 'Usuarios'),
    soon('/admin/encuestas', 'Encuestas'),
  ],
};
