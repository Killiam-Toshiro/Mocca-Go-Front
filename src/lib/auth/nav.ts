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
    soon('/operador/cocina', 'Cocina'),
    soon('/operador/productos', 'Productos'),
    soon('/operador/inventario', 'Inventario'),
  ],
  repartidor: [
    { href: ROLE_HOME.repartidor, label: 'Inicio', enabled: true },
    soon('/repartidor/cola', 'Cola de despacho'),
    soon('/repartidor/rondas', 'Mis rondas'),
  ],
  admin: [
    { href: ROLE_HOME.admin, label: 'Inicio', enabled: true },
    soon('/admin/metricas', 'Métricas'),
    soon('/admin/pedidos', 'Pedidos'),
    soon('/admin/catalogo', 'Catálogo'),
    soon('/admin/zonas', 'Zonas y puntos'),
    soon('/admin/usuarios', 'Usuarios'),
    soon('/admin/encuestas', 'Encuestas'),
  ],
};
