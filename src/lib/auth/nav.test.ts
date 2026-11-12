import { describe, expect, it } from 'vitest';
import { NAV, ROLE_LABEL } from './nav';
import { canAccess, ROLE_HOME, ROLES } from './roles';

describe('NAV', () => {
  it.each(ROLES)(
    '%s: la primera opción es «Inicio» y lleva a su home',
    (role) => {
      expect(NAV[role][0]).toEqual({
        href: ROLE_HOME[role],
        label: 'Inicio',
        enabled: true,
      });
    },
  );

  it.each(ROLES)('%s: todas las rutas son de su propio rol (CA-19)', (role) => {
    for (const item of NAV[role]) expect(canAccess(role, item.href)).toBe(true);
  });

  it('solo están habilitadas las secciones ya construidas', () => {
    for (const role of ROLES) {
      const enabled = NAV[role].filter((i) => i.enabled).map((i) => i.label);
      const expected: Record<(typeof ROLES)[number], string[]> = {
        cliente: ['Inicio', 'Menú', 'Mis pedidos', 'Mi perfil'],
        operador: ['Inicio', 'Cocina', 'Productos', 'Inventario', 'Mi cuenta'],
        admin: [
          'Inicio',
          'Cocina',
          'Inventario',
          'Catálogo',
          'Usuarios',
          'Mi cuenta',
        ],
        repartidor: ['Inicio', 'Cola de despacho', 'Mis rondas', 'Mi cuenta'],
      };
      expect(enabled).toEqual(expected[role]);
    }
  });

  it('«Mi cuenta» existe para el personal y no para el cliente (007a)', () => {
    for (const role of ['admin', 'operador', 'repartidor'] as const)
      expect(NAV[role]).toContainEqual({
        href: `/${role}/cuenta`,
        label: 'Mi cuenta',
        enabled: true,
      });
    expect(NAV.cliente.map((i) => i.label)).not.toContain('Mi cuenta');
  });

  it('cada rol ve únicamente sus secciones', () => {
    const labels = (role: (typeof ROLES)[number]) =>
      NAV[role].map((i) => i.label);
    expect(labels('admin')).toContain('Usuarios');
    expect(labels('cliente')).not.toContain('Usuarios');
    expect(labels('operador')).toContain('Cocina');
    expect(labels('admin')).toContain('Cocina');
    expect(labels('cliente')).not.toContain('Cocina');
    expect(labels('operador')).toEqual(
      expect.arrayContaining(['Productos', 'Inventario']),
    );
    expect(labels('admin')).toContain('Inventario');
    expect(labels('cliente')).not.toContain('Inventario');
    expect(labels('repartidor')).not.toContain('Inventario');
    expect(labels('repartidor')).toContain('Mis rondas');
    expect(labels('cliente')).toContain('Mis pedidos');
  });

  it('no hay rutas repetidas dentro de un rol', () => {
    for (const role of ROLES) {
      const hrefs = NAV[role].map((i) => i.href);
      expect(new Set(hrefs).size).toBe(hrefs.length);
    }
  });

  it('cada rol tiene su nombre para mostrar', () => {
    expect(ROLE_LABEL).toEqual({
      cliente: 'Cliente',
      operador: 'Operador',
      repartidor: 'Repartidor',
      admin: 'Administrador',
    });
  });
});
