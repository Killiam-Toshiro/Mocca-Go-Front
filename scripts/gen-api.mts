/**
 * Genera, a partir de docs/openapi.json (fuente única del contrato):
 *   - src/lib/api/schema.d.ts        tipos de openapi-typescript
 *   - src/lib/api/routes.generated.ts tabla de rutas que puede reenviar la pasarela
 *
 * Uso:  node scripts/gen-api.mts           regenera
 *       node scripts/gen-api.mts --check   falla si lo versionado no coincide
 *
 * Se ejecuta con Node 24 (type stripping): sin transpilador.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import openapiTS, { astToString } from 'openapi-typescript';

export const API_PREFIX = '/api/v1';
const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;
/** Rutas que Next atiende por sí mismo; la pasarela nunca las reenvía. */
const OWN_ROUTES = new Set(['POST /auth/login', 'POST /auth/logout']);

export type HttpMethod = Uppercase<(typeof METHODS)[number]>;

export interface RouteEntry {
  method: HttpMethod;
  /** Ruta sin `/api/v1`, con parámetros como `{id}`. */
  pattern: string;
  /** Sin `security` en el contrato: no exige token. */
  public: boolean;
  /** La atiende Next (login/logout), no el back directamente. */
  own: boolean;
  /** Responde `text/event-stream`. */
  stream: boolean;
}

interface Operation {
  security?: unknown[];
  responses?: Record<string, { content?: Record<string, unknown> }>;
}
export interface OpenApiDoc {
  paths: Record<string, Record<string, Operation>>;
}

export function stripApiPrefix(path: string): string {
  if (!path.startsWith(`${API_PREFIX}/`)) {
    throw new Error(`La ruta ${path} no empieza por ${API_PREFIX}/`);
  }
  return path.slice(API_PREFIX.length);
}

function isStream(operation: Operation): boolean {
  return Object.values(operation.responses ?? {}).some((response) =>
    Object.keys(response.content ?? {}).includes('text/event-stream'),
  );
}

export function buildRouteTable(doc: OpenApiDoc): RouteEntry[] {
  const routes: RouteEntry[] = [];
  for (const [path, item] of Object.entries(doc.paths)) {
    const pattern = stripApiPrefix(path);
    for (const verb of METHODS) {
      const operation = item[verb];
      if (!operation) continue;
      const method = verb.toUpperCase() as HttpMethod;
      routes.push({
        method,
        pattern,
        public: !operation.security || operation.security.length === 0,
        own: OWN_ROUTES.has(`${method} ${pattern}`),
        stream: isStream(operation),
      });
    }
  }
  return routes.sort(
    (a, b) =>
      a.pattern.localeCompare(b.pattern) || a.method.localeCompare(b.method),
  );
}

export function renderRoutesModule(routes: RouteEntry[]): string {
  const rows = routes
    .map(
      (r) =>
        `  { method: '${r.method}', pattern: '${r.pattern}', public: ${r.public}, own: ${r.own}, stream: ${r.stream} },`,
    )
    .join('\n');
  return `/* eslint-disable */
// GENERADO por scripts/gen-api.mts a partir de docs/openapi.json. No editar a mano:
// ejecuta \`npm run api:types\`.

export interface RouteEntry {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Ruta sin /api/v1, con parámetros como {id}. */
  pattern: string;
  /** Sin security en el contrato: no exige token. */
  public: boolean;
  /** La atiende Next (login/logout), no el back directamente. */
  own: boolean;
  /** Responde text/event-stream. */
  stream: boolean;
}

export const ROUTES: readonly RouteEntry[] = [
${rows}
];
`;
}

/** Los tipos van sin `/api/v1`: el cliente usa `/api` como base y la pasarela añade el prefijo. */
export function withoutApiPrefix<T extends OpenApiDoc>(doc: T): T {
  const paths = Object.fromEntries(
    Object.entries(doc.paths).map(([path, item]) => [
      stripApiPrefix(path),
      item,
    ]),
  );
  return { ...doc, paths };
}

export async function renderSchema(doc: OpenApiDoc): Promise<string> {
  const ast = await openapiTS(
    withoutApiPrefix(doc) as unknown as Parameters<typeof openapiTS>[0],
  );
  return `/* eslint-disable */\n// GENERADO por scripts/gen-api.mts a partir de docs/openapi.json. No editar a mano.\n\n${astToString(ast)}`;
}

const root = new URL('../', import.meta.url);
const SPEC = new URL('docs/openapi.json', root);
const OUTPUTS = {
  schema: new URL('src/lib/api/schema.d.ts', root),
  routes: new URL('src/lib/api/routes.generated.ts', root),
};

export async function generate(): Promise<{ schema: string; routes: string }> {
  const doc = JSON.parse(readFileSync(SPEC, 'utf8')) as OpenApiDoc;
  return {
    schema: await renderSchema(doc),
    routes: renderRoutesModule(buildRouteTable(doc)),
  };
}

async function main(): Promise<void> {
  const check = process.argv.includes('--check');
  const generated = await generate();
  let stale = false;
  for (const key of ['schema', 'routes'] as const) {
    const file = OUTPUTS[key];
    const current = existsSync(file) ? readFileSync(file, 'utf8') : null;
    if (current === generated[key]) continue;
    if (check) {
      stale = true;
      console.error(`Desactualizado: ${fileURLToPath(file)}`);
    } else {
      writeFileSync(file, generated[key]);
      console.log(`Generado: ${fileURLToPath(file)}`);
    }
  }
  if (check) {
    if (stale) {
      console.error('Ejecuta `npm run api:types` y revisa el cambio.');
      process.exit(1);
    }
    console.log('El contrato generado está al día con docs/openapi.json.');
  }
}

if (import.meta.main) await main();
