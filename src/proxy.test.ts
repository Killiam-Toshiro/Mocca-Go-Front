// @vitest-environment node
import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const env = vi.hoisted(() => ({
  API_URL: 'http://x/api/v1',
  TRUST_PROXY_HOPS: 0,
  COOKIE_SECURE: false,
  ALLOWED_ORIGINS: [] as string[],
}));
vi.mock('@/lib/server/env', () => ({ getEnv: () => env }));

import { proxy } from './proxy';

const req = (path: string, headers: Record<string, string> = {}) =>
  new NextRequest(`http://localhost:3001${path}`, { headers });

beforeEach(() => {
  env.COOKIE_SECURE = false;
});

describe('proxy: guarda de cookie', () => {
  it('ruta privada sin cookie → 307 a /login?next=…', () => {
    const response = proxy(req('/operador/cocina?x=1'));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe(
      'http://localhost:3001/login?next=%2Foperador%2Fcocina%3Fx%3D1',
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-frame-options')).toBe('DENY');
  });

  it('ruta privada con cookie → pasa', () => {
    const response = proxy(req('/admin', { cookie: 'session=abc' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('location')).toBeNull();
  });

  it('con cookies Secure la cookie sin prefijo no cuenta', () => {
    env.COOKIE_SECURE = true;
    expect(proxy(req('/admin', { cookie: 'session=abc' })).status).toBe(307);
    expect(proxy(req('/admin', { cookie: '__Host-session=abc' })).status).toBe(
      200,
    );
  });

  it.each(['/', '/login', '/registro'])('%s es pública', (path) => {
    expect(proxy(req(path)).status).toBe(200);
  });
});

describe('proxy: CSP y cabeceras (CA-21)', () => {
  it('una página lleva CSP con nonce y las cabeceras de seguridad', () => {
    const response = proxy(req('/login'));
    const csp = response.headers.get('content-security-policy') ?? '';
    expect(csp).toMatch(
      /script-src 'self' 'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/,
    );
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
    expect(response.headers.get('referrer-policy')).toBe(
      'strict-origin-when-cross-origin',
    );
    expect(response.headers.get('strict-transport-security')).toBeNull();
  });

  it('con Secure añade HSTS', () => {
    env.COOKIE_SECURE = true;
    expect(
      proxy(req('/login')).headers.get('strict-transport-security'),
    ).toContain('max-age');
  });

  it('el nonce es distinto en cada petición', () => {
    const nonceOf = (response: Response) =>
      /'nonce-([^']+)'/.exec(
        response.headers.get('content-security-policy') ?? '',
      )?.[1];
    expect(nonceOf(proxy(req('/login')))).not.toBe(
      nonceOf(proxy(req('/login'))),
    );
  });

  it('no fía de x-nonce ni de x-next-path que envíe el cliente', () => {
    const response = proxy(
      req('/login', { 'x-nonce': 'falso', 'x-next-path': '/admin' }),
    );
    const forwarded = response.headers.get('x-middleware-request-x-nonce');
    expect(forwarded).not.toBe('falso');
    expect(response.headers.get('x-middleware-request-x-next-path')).toBe(
      '/login',
    );
  });

  it('la API recibe las cabeceras básicas pero no CSP ni guarda de página', () => {
    const response = proxy(req('/api/users'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-security-policy')).toBeNull();
    expect(response.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
