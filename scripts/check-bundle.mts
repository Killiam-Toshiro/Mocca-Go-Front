/**
 * Comprueba que lo que se sirve al navegador (`.next/static`) no contiene configuración
 * del servidor: nombres de variables privadas ni el valor real de `API_URL` (CA-02, CA-22).
 * Uso: `npm run build && npm run check:bundle` (opcional: `API_URL=... npm run check:bundle`).
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Nombres de variables que solo el servidor debe conocer. */
export const FORBIDDEN_NAMES = [
  'API_URL',
  'TRUST_PROXY_HOPS',
  'ALLOWED_ORIGINS',
  'COOKIE_SECURE',
] as const;

export interface Leak {
  file: string;
  needle: string;
}

/** Busca cada cadena prohibida en el contenido de cada archivo. */
export function findLeaks(
  files: ReadonlyMap<string, string>,
  needles: readonly string[],
): Leak[] {
  const leaks: Leak[] = [];
  for (const [file, content] of files) {
    for (const needle of needles) {
      if (needle && content.includes(needle)) leaks.push({ file, needle });
    }
  }
  return leaks;
}

function readTree(dir: string, into = new Map<string, string>()) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) readTree(path, into);
    else if (/\.(js|css|html|json|txt|map)$/.test(name))
      into.set(path, readFileSync(path, 'utf8'));
  }
  return into;
}

function main(): number {
  const root = join(process.cwd(), '.next', 'static');
  let files: Map<string, string>;
  try {
    files = readTree(root);
  } catch {
    console.error('No existe .next/static: ejecuta primero `npm run build`.');
    return 2;
  }
  const needles: string[] = [...FORBIDDEN_NAMES];
  const apiUrl = process.env.API_URL?.trim();
  if (apiUrl) {
    needles.push(apiUrl);
    try {
      needles.push(new URL(apiUrl).host);
    } catch {
      /* el valor ya se comprueba entero */
    }
  }
  const leaks = findLeaks(files, needles);
  if (leaks.length > 0) {
    console.error('Configuración del servidor encontrada en el cliente:');
    for (const { file, needle } of leaks)
      console.error(`  - ${file}: «${needle}»`);
    return 1;
  }
  console.log(
    `check:bundle correcto: ${files.size} archivos revisados, sin configuración del servidor.`,
  );
  return 0;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) process.exit(main());
