// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildSessionCookies,
  clearSessionCookies,
  readCookie,
  serializeCookie,
  sessionCookieName,
} from './cookies';

describe('sessionCookieName', () => {
  it('usa el prefijo __Host- solo con Secure', () => {
    expect(sessionCookieName(true)).toBe('__Host-session');
    expect(sessionCookieName(false)).toBe('session');
  });
});

describe('buildSessionCookies', () => {
  const now = 1_700_000_000_000;

  it('session: httpOnly, Lax, Path=/, Secure y Max-Age = expiresIn', () => {
    const { session } = buildSessionCookies(
      { token: 'jwt', expiresIn: 900, now },
      true,
    );
    expect(session).toEqual({
      name: '__Host-session',
      value: 'jwt',
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 900,
    });
  });

  it('session_exp: legible por JS, mismo Max-Age y solo la hora de vencimiento', () => {
    const { exp, expiresAt } = buildSessionCookies(
      { token: 'jwt', expiresIn: 900, now },
      true,
    );
    expect(expiresAt).toBe(now + 900_000);
    expect(exp).toEqual({
      name: 'session_exp',
      value: String(now + 900_000),
      httpOnly: false,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 900,
    });
    expect(exp.value).not.toContain('jwt');
  });

  it('sin Secure no usa prefijo y deja secure en false', () => {
    const { session, exp } = buildSessionCookies(
      { token: 'jwt', expiresIn: 60, now },
      false,
    );
    expect(session).toMatchObject({
      name: 'session',
      secure: false,
      httpOnly: true,
    });
    expect(exp).toMatchObject({ name: 'session_exp', secure: false });
  });

  it.each([0, -5, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rechaza expiresIn %s',
    (expiresIn) => {
      expect(() =>
        buildSessionCookies({ token: 'jwt', expiresIn }, true),
      ).toThrow(/expiresIn/);
    },
  );

  it('rechaza un token vacío', () => {
    expect(() =>
      buildSessionCookies({ token: '', expiresIn: 60 }, true),
    ).toThrow();
  });
});

describe('clearSessionCookies', () => {
  it('borra ambas cookies con Max-Age 0 y los mismos atributos de ruta', () => {
    const cleared = clearSessionCookies(true);
    expect(cleared.map((c) => c.name)).toEqual([
      '__Host-session',
      'session_exp',
    ]);
    for (const cookie of cleared) {
      expect(cookie).toMatchObject({
        value: '',
        maxAge: 0,
        path: '/',
        sameSite: 'lax',
        secure: true,
      });
    }
    expect(cleared[0]?.httpOnly).toBe(true);
  });

  it('sin Secure usa el nombre sin prefijo', () => {
    expect(clearSessionCookies(false).map((c) => c.name)).toEqual([
      'session',
      'session_exp',
    ]);
  });
});

describe('serializeCookie', () => {
  it('escribe los atributos de la cookie de sesión', () => {
    const { session } = buildSessionCookies(
      { token: 'a.b-c', expiresIn: 900 },
      true,
    );
    expect(serializeCookie(session)).toBe(
      '__Host-session=a.b-c; Max-Age=900; Path=/; HttpOnly; Secure; SameSite=Lax',
    );
  });

  it('sin HttpOnly ni Secure para session_exp en local', () => {
    const { exp } = buildSessionCookies(
      { token: 't', expiresIn: 60, now: 0 },
      false,
    );
    expect(serializeCookie(exp)).toBe(
      'session_exp=60000; Max-Age=60; Path=/; SameSite=Lax',
    );
  });

  it('el borrado lleva Max-Age=0', () => {
    expect(serializeCookie(clearSessionCookies(false)[0]!)).toBe(
      'session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax',
    );
  });
});

describe('readCookie', () => {
  const header = 'a=1; session=tok%20en; session_exp=99';

  it('lee por nombre exacto', () => {
    expect(readCookie(header, 'session')).toBe('tok en');
    expect(readCookie(header, 'session_exp')).toBe('99');
    expect(readCookie(header, 'ses')).toBeNull();
  });

  it('tolera cabecera vacía o valor mal codificado', () => {
    expect(readCookie(null, 'session')).toBeNull();
    expect(readCookie('', 'session')).toBeNull();
    expect(readCookie('session=%E0%A4%A', 'session')).toBeNull();
  });
});
