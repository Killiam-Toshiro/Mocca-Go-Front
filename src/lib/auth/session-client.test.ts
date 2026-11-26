import { describe, expect, it } from 'vitest';
import { parseExpiryCookie } from './session-client';
import { buildExpiredUrl, isAuthPagePath } from './expire';

describe('parseExpiryCookie', () => {
  it('lee session_exp entre otras cookies', () => {
    expect(parseExpiryCookie('a=1; session_exp=1700000000000; b=2')).toBe(
      1_700_000_000_000,
    );
  });

  it('no confunde cookies con nombre parecido', () => {
    expect(parseExpiryCookie('my_session_exp=5; session_exp_x=7')).toBeNull();
  });

  it.each([
    '',
    'session_exp=',
    'session_exp=abc',
    'session_exp=-4',
    'session_exp=0',
    'session_exp=1.5',
  ])('descarta %j', (cookie) => {
    expect(parseExpiryCookie(cookie)).toBeNull();
  });
});

describe('buildExpiredUrl', () => {
  it('conserva la ruta y la consulta', () => {
    expect(buildExpiredUrl('/admin/usuarios?p=2')).toBe(
      '/api/auth/expired?next=%2Fadmin%2Fusuarios%3Fp%3D2',
    );
  });

  it('descarta un destino peligroso', () => {
    expect(buildExpiredUrl('//evil.test')).toBe('/api/auth/expired');
  });
});

describe('isAuthPagePath', () => {
  it('reconoce login y registro', () => {
    expect(isAuthPagePath('/login')).toBe(true);
    expect(isAuthPagePath('/registro')).toBe(true);
    expect(isAuthPagePath('/admin')).toBe(false);
  });
});
