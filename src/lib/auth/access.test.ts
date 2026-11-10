import { describe, expect, it } from 'vitest';
import { decideAccess, decideAuthPageAccess } from './access';
import type { SessionResult } from './types';

const ok = (
  role: 'cliente' | 'operador' | 'repartidor' | 'admin',
): SessionResult => ({
  status: 'ok',
  user: { id: '1', username: 'x', role },
  expiresAt: 123,
});

describe('decideAccess', () => {
  it('sin sesión → /login con next', () => {
    expect(
      decideAccess({ status: 'none' }, 'admin', '/admin/usuarios'),
    ).toEqual({
      action: 'redirect',
      to: '/login?next=%2Fadmin%2Fusuarios',
    });
  });

  it('sesión muerta → /api/auth/expired (borra cookies) con next, sin bucle', () => {
    expect(decideAccess({ status: 'expired' }, 'admin', '/admin')).toEqual({
      action: 'redirect',
      to: '/api/auth/expired?next=%2Fadmin',
    });
  });

  it('el back caído no cierra la sesión', () => {
    expect(decideAccess({ status: 'error' }, 'admin', '/admin')).toEqual({
      action: 'unavailable',
    });
  });

  it('rol equivocado → home propio', () => {
    expect(decideAccess(ok('cliente'), 'admin', '/admin')).toEqual({
      action: 'redirect',
      to: '/cliente',
    });
    expect(decideAccess(ok('operador'), 'repartidor', '/repartidor')).toEqual({
      action: 'redirect',
      to: '/operador',
    });
  });

  it('rol correcto, o cualquiera si no se exige uno → renderiza', () => {
    expect(decideAccess(ok('admin'), 'admin', '/admin')).toMatchObject({
      action: 'render',
    });
    expect(decideAccess(ok('cliente'), null, '/cliente')).toMatchObject({
      action: 'render',
      expiresAt: 123,
    });
  });

  it('descarta un next peligroso', () => {
    expect(decideAccess({ status: 'none' }, null, '//evil.test')).toEqual({
      action: 'redirect',
      to: '/login',
    });
  });
});

describe('decideAuthPageAccess', () => {
  it('con sesión válida va al home del rol', () => {
    expect(decideAuthPageAccess(ok('repartidor'))).toEqual({
      redirectTo: '/repartidor',
    });
  });

  it.each([
    { status: 'none' },
    { status: 'expired' },
    { status: 'error' },
  ] as const)('con estado %j muestra el formulario', (session) => {
    expect(decideAuthPageAccess(session)).toEqual({ redirectTo: null });
  });
});
