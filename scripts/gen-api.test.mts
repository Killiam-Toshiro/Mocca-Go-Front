// @vitest-environment node
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  buildRouteTable,
  generate,
  stripApiPrefix,
  withoutApiPrefix,
  type OpenApiDoc,
} from './gen-api.mts';

const doc = JSON.parse(
  readFileSync(new URL('../docs/openapi.json', import.meta.url), 'utf8'),
) as OpenApiDoc;
const routes = buildRouteTable(doc);
const find = (method: string, pattern: string) =>
  routes.find((r) => r.method === method && r.pattern === pattern);

describe('stripApiPrefix', () => {
  it('quita /api/v1', () => {
    expect(stripApiPrefix('/api/v1/users/{id}')).toBe('/users/{id}');
  });
  it('rechaza rutas fuera del prefijo', () => {
    expect(() => stripApiPrefix('/otra/ruta')).toThrow();
  });
});

describe('buildRouteTable', () => {
  it('incluye las 53 operaciones del contrato, sin duplicados ni prefijo', () => {
    expect(routes).toHaveLength(53);
    const keys = routes.map((r) => `${r.method} ${r.pattern}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(routes.every((r) => !r.pattern.startsWith('/api'))).toBe(true);
  });

  it('marca como públicas solo las que no exigen token', () => {
    const publicKeys = routes
      .filter((r) => r.public)
      .map((r) => `${r.method} ${r.pattern}`)
      .sort();
    expect(publicKeys).toEqual([
      'GET /delivery-zones',
      'GET /health',
      'GET /health/ready',
      'GET /menu',
      'POST /auth/login',
      'POST /customers',
    ]);
  });

  it('marca como propias solo login y logout', () => {
    expect(
      routes
        .filter((r) => r.own)
        .map((r) => `${r.method} ${r.pattern}`)
        .sort(),
    ).toEqual(['POST /auth/login', 'POST /auth/logout']);
  });

  it('marca como stream solo los tres SSE', () => {
    expect(
      routes
        .filter((r) => r.stream)
        .map((r) => r.pattern)
        .sort(),
    ).toEqual(['/dispatch/stream', '/kitchen/stream', '/orders/stream']);
  });

  it('conserva método y parámetros de ruta', () => {
    expect(find('PATCH', '/users/{id}/role')).toMatchObject({
      public: false,
      own: false,
    });
    expect(find('DELETE', '/menu')).toBeUndefined();
  });
});

describe('withoutApiPrefix', () => {
  it('reescribe las rutas sin tocar el original', () => {
    const out = withoutApiPrefix(doc);
    expect(Object.keys(out.paths).every((p) => !p.startsWith('/api'))).toBe(
      true,
    );
    expect(Object.keys(doc.paths).every((p) => p.startsWith('/api/v1/'))).toBe(
      true,
    );
  });
});

describe('archivos generados', () => {
  it('lo versionado coincide con lo que genera docs/openapi.json', async () => {
    const generated = await generate();
    const read = (name: string) =>
      readFileSync(new URL(`../src/lib/api/${name}`, import.meta.url), 'utf8');
    expect(read('routes.generated.ts')).toBe(generated.routes);
    expect(read('schema.d.ts')).toBe(generated.schema);
  });
});
