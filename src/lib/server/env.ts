import 'server-only';

/** Configuración del servidor ya validada. Nada de esto se expone al navegador. */
export interface AppEnv {
  /** URL base del back, con `/api/v1` y sin `/` final. */
  API_URL: string;
  /** Proxies de confianza delante de Next (0 en local, 1 en Railway). */
  TRUST_PROXY_HOPS: number;
  /** Atributo `Secure` y prefijo `__Host-` de la cookie de sesión. */
  COOKIE_SECURE: boolean;
  /** Orígenes adicionales aceptados en peticiones que modifican datos. */
  ALLOWED_ORIGINS: string[];
}

export const MAX_TRUST_PROXY_HOPS = 10;

export class EnvError extends Error {
  readonly problems: string[];

  constructor(problems: string[]) {
    super(`Configuración inválida. ${problems.join(' ')}`);
    this.name = 'EnvError';
    this.problems = problems;
  }
}

type Source = Record<string, string | undefined>;

function parseApiUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  let url: URL;
  try {
    url = new URL(value.trim());
  } catch {
    return null;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (url.username || url.password || url.search || url.hash) return null;
  return url.toString().replace(/\/+$/, '');
}

function parseHops(value: string | undefined): number | null {
  const raw = value?.trim() ?? '';
  if (raw === '') return 0;
  if (!/^\d+$/.test(raw)) return null;
  const hops = Number(raw);
  return hops <= MAX_TRUST_PROXY_HOPS ? hops : null;
}

function parseCookieSecure(
  value: string | undefined,
  nodeEnv: string | undefined,
): boolean | null {
  const raw = value?.trim().toLowerCase() ?? '';
  if (raw === '') return nodeEnv === 'production';
  if (raw === 'true') return true;
  if (raw === 'false') return false;
  return null;
}

function parseOrigins(value: string | undefined): string[] | null {
  const entries = (value ?? '')
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean);
  const origins: string[] = [];
  for (const entry of entries) {
    let origin: string;
    try {
      const url = new URL(entry);
      if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
      origin = url.origin;
    } catch {
      return null;
    }
    // Solo se aceptan orígenes exactos: sin ruta, sin «/» final y sin comodines.
    if (origin !== entry) return null;
    if (!origins.includes(origin)) origins.push(origin);
  }
  return origins;
}

/**
 * Valida la configuración. Los mensajes nombran la variable pero nunca
 * reproducen su valor, por si contiene credenciales.
 */
export function parseEnv(source: Source): AppEnv {
  const problems: string[] = [];

  const apiUrl = parseApiUrl(source.API_URL);
  if (apiUrl === null) {
    problems.push(
      source.API_URL?.trim()
        ? 'API_URL debe ser una URL http(s) sin credenciales, parámetros ni fragmento (por ejemplo http://localhost:3000/api/v1).'
        : 'API_URL es obligatoria (por ejemplo http://localhost:3000/api/v1).',
    );
  }

  const hops = parseHops(source.TRUST_PROXY_HOPS);
  if (hops === null) {
    problems.push(
      `TRUST_PROXY_HOPS debe ser un entero entre 0 y ${MAX_TRUST_PROXY_HOPS} escrito solo con dígitos.`,
    );
  }

  const secure = parseCookieSecure(source.COOKIE_SECURE, source.NODE_ENV);
  if (secure === null) problems.push('COOKIE_SECURE debe ser true o false.');

  const origins = parseOrigins(source.ALLOWED_ORIGINS);
  if (origins === null) {
    problems.push(
      'ALLOWED_ORIGINS debe ser una lista de orígenes http(s) separados por comas, sin ruta ni «/» final.',
    );
  }

  if (problems.length > 0) throw new EnvError(problems);

  return {
    API_URL: apiUrl as string,
    TRUST_PROXY_HOPS: hops as number,
    COOKIE_SECURE: secure as boolean,
    ALLOWED_ORIGINS: origins as string[],
  };
}

let cached: AppEnv | undefined;

/** Lee y valida `process.env` una sola vez. */
export function getEnv(): AppEnv {
  cached ??= parseEnv(process.env);
  return cached;
}
