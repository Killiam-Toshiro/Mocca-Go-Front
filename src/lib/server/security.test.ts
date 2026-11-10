// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  buildCsp,
  decideGuard,
  generateNonce,
  securityHeaders,
} from './security';

describe('buildCsp', () => {
  const csp = buildCsp('abc123');
  const directive = (name: string) =>
    csp.split('; ').find((part) => part.startsWith(`${name} `)) ?? '';

  it('incluye las directivas de la spec', () => {
    expect(directive('default-src')).toBe("default-src 'self'");
    expect(directive('script-src')).toBe(
      "script-src 'self' 'nonce-abc123' 'strict-dynamic'",
    );
    expect(directive('connect-src')).toBe("connect-src 'self'");
    expect(directive('object-src')).toBe("object-src 'none'");
    expect(directive('base-uri')).toBe("base-uri 'none'");
    expect(directive('form-action')).toBe("form-action 'self'");
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive('style-src')).toBe("style-src 'self' 'unsafe-inline'");
  });

  it('en producción no permite eval ni scripts en línea sin nonce', () => {
    expect(csp).not.toContain('unsafe-eval');
    expect(directive('script-src')).not.toContain('unsafe-inline');
  });

  it('en desarrollo añade unsafe-eval solo a los scripts', () => {
    const dev = buildCsp('n', { dev: true });
    expect(dev).toContain(
      "script-src 'self' 'nonce-n' 'strict-dynamic' 'unsafe-eval'",
    );
    expect(dev.match(/unsafe-eval/g)).toHaveLength(1);
  });
});

describe('generateNonce', () => {
  it('es distinto en cada llamada y seguro para una cabecera', () => {
    const nonces = new Set(Array.from({ length: 50 }, generateNonce));
    expect(nonces.size).toBe(50);
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9+/=]+$/);
  });
});

describe('securityHeaders', () => {
  it('incluye las cabeceras base', () => {
    const headers = securityHeaders({ secure: false });
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['X-Frame-Options']).toBe('DENY');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(headers['Permissions-Policy']).toContain('camera=()');
  });

  it('HSTS solo con HTTPS', () => {
    expect(
      securityHeaders({ secure: false })['Strict-Transport-Security'],
    ).toBeUndefined();
    expect(
      securityHeaders({ secure: true })['Strict-Transport-Security'],
    ).toContain('max-age=');
  });
});

describe('decideGuard', () => {
  const guard = (pathname: string, hasSession: boolean, search = '') =>
    decideGuard({ pathname, search, hasSession });

  it('sin cookie, ruta privada → /login?next=…', () => {
    expect(guard('/admin', false)).toEqual({
      action: 'redirect',
      to: '/login?next=%2Fadmin',
    });
    expect(guard('/cliente/pedidos', false, '?a=1')).toEqual({
      action: 'redirect',
      to: '/login?next=%2Fcliente%2Fpedidos%3Fa%3D1',
    });
  });

  it('con cookie, ruta privada pasa (la valida el layout)', () => {
    expect(guard('/admin', true)).toEqual({ action: 'next' });
  });

  it.each(['/', '/login', '/registro', '/menu', '/clientes'])(
    '%s es pública',
    (path) => {
      expect(guard(path, false)).toEqual({ action: 'next' });
    },
  );
});
