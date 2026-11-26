import { describe, expect, it } from 'vitest';
import { parseSafeNext, resolveNext, sanitizeReturnPath } from './safe-next';

describe('resolveNext', () => {
  it('respeta una ruta interna que el rol puede ver', () => {
    expect(resolveNext('/cliente/pedidos?x=1', 'cliente')).toBe(
      '/cliente/pedidos?x=1',
    );
  });

  it('sin next, usa el home del rol', () => {
    expect(resolveNext(undefined, 'operador')).toBe('/operador');
    expect(resolveNext(null, 'repartidor')).toBe('/repartidor');
    expect(resolveNext('', 'admin')).toBe('/admin');
  });

  it('una ruta de otro rol se ignora', () => {
    expect(resolveNext('/admin', 'cliente')).toBe('/cliente');
    expect(resolveNext('/operador/cocina', 'repartidor')).toBe('/repartidor');
  });

  it('una ruta pública o de la API se ignora (evita bucles con /login)', () => {
    expect(resolveNext('/login', 'cliente')).toBe('/cliente');
    expect(resolveNext('/', 'cliente')).toBe('/cliente');
    expect(resolveNext('/api/menu', 'cliente')).toBe('/cliente');
  });

  it.each([
    'https://evil.test/cliente',
    'http://evil.test',
    '//evil.test/cliente',
    '///evil.test',
    '/\\evil.test',
    '/cliente\\..\\admin',
    'javascript:alert(1)',
    'cliente',
    '/\t/evil.test',
    '/cliente\n',
    '/cliente\u0000',
    ' /cliente',
  ])('ignora %j', (next) => {
    expect(parseSafeNext(next, 'cliente')).toBeNull();
    expect(resolveNext(next, 'cliente')).toBe('/cliente');
  });

  it('normaliza antes de comprobar el rol (no se cuela con ..)', () => {
    expect(parseSafeNext('/cliente/../admin', 'cliente')).toBeNull();
    expect(parseSafeNext('/cliente/../admin', 'admin')).toBe('/admin');
    expect(parseSafeNext('/cliente/./pedidos', 'cliente')).toBe(
      '/cliente/pedidos',
    );
  });

  it('descarta el fragmento y conserva la consulta', () => {
    expect(parseSafeNext('/cliente?a=1#x', 'cliente')).toBe('/cliente?a=1');
  });
});

describe('sanitizeReturnPath', () => {
  it('acepta rutas internas de cualquier rol', () => {
    expect(sanitizeReturnPath('/admin/usuarios?p=2')).toBe(
      '/admin/usuarios?p=2',
    );
  });

  it.each([
    null,
    undefined,
    '',
    'https://evil.test',
    '//evil.test',
    '/\\x',
    '/a\nb',
  ])('rechaza %j', (value) => {
    expect(sanitizeReturnPath(value)).toBeNull();
  });
});
