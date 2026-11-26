import { describe, expect, it } from 'vitest';
import {
  canAccess,
  isPrivatePath,
  isRole,
  ROLE_HOME,
  ROLES,
  roleOwningPath,
} from './roles';

describe('roles', () => {
  it('el home de cada rol pertenece a ese rol', () => {
    for (const role of ROLES) {
      expect(canAccess(role, ROLE_HOME[role])).toBe(true);
      expect(roleOwningPath(ROLE_HOME[role])).toBe(role);
    }
  });

  it('cada rol solo entra a su prefijo (y a sus subrutas)', () => {
    for (const role of ROLES) {
      for (const other of ROLES) {
        expect(canAccess(role, `${ROLE_HOME[other]}/algo`)).toBe(
          role === other,
        );
      }
    }
  });

  it('el prefijo se compara por segmento completo', () => {
    expect(canAccess('admin', '/administrador')).toBe(false);
    expect(canAccess('cliente', '/clientes')).toBe(false);
    expect(roleOwningPath('/cliente-x')).toBeNull();
  });

  it('las rutas públicas no pertenecen a ningún rol', () => {
    for (const path of ['/', '/login', '/registro', '/api/menu']) {
      expect(roleOwningPath(path)).toBeNull();
      expect(isPrivatePath(path)).toBe(false);
    }
    expect(isPrivatePath('/operador/cocina')).toBe(true);
  });

  it('isRole valida el valor', () => {
    expect(isRole('admin')).toBe(true);
    expect(isRole('superadmin')).toBe(false);
    expect(isRole(undefined)).toBe(false);
  });
});
