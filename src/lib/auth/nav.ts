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
    { href: '/cliente/perfil', label: 'Mi perfil', enabled: true },
  ],
  operador: [
    { href: ROLE_HOME.operador, label: 'Inicio', enabled: true },
    { href: '/operador/cocina', label: 'Cocina', enabled: true },
    { href: '/operador/productos', label: 'Productos', enabled: true },
    { href: '/operador/inventario', label: 'Inventario', enabled: true },
    { href: '/operador/cuenta', label: 'Mi cuenta', enabled: true },
  ],
  repartidor: [
    { href: ROLE_HOME.repartidor, label: 'Inicio', enabled: true },
    { href: '/repartidor/cola', label: 'Cola de despacho', enabled: true },
    { href: '/repartidor/rondas', label: 'Mis rondas', enabled: true },
    { href: '/repartidor/cuenta', label: 'Mi cuenta', enabled: true },
  ],
  admin: [
    { href: ROLE_HOME.admin, label: 'Inicio', enabled: true },
    { href: '/admin/cocina', label: 'Cocina', enabled: true },
    { href: '/admin/inventario', label: 'Inventario', enabled: true },
    soon('/admin/metricas', 'Métricas'),
    soon('/admin/pedidos', 'Pedidos'),
    soon('/admin/catalogo', 'Catálogo'),
    soon('/admin/zonas', 'Zonas y puntos'),
    { href: '/admin/usuarios', label: 'Usuarios', enabled: true },
    soon('/admin/encuestas', 'Encuestas'),
    { href: '/admin/cuenta', label: 'Mi cuenta', enabled: true },
  ],
};
