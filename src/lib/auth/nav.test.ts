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
      expect(enabled).toEqual(
        role === 'cliente' ? ['Inicio', 'Menú', 'Mis pedidos'] : ['Inicio'],
      );
    }
  });

  it('cada rol ve únicamente sus secciones', () => {
    const labels = (role: (typeof ROLES)[number]) =>
      NAV[role].map((i) => i.label);
    expect(labels('admin')).toContain('Usuarios');
    expect(labels('cliente')).not.toContain('Usuarios');
    expect(labels('operador')).toContain('Cocina');
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
