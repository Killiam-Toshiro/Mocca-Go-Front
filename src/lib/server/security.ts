import 'server-only';
import { isPrivatePath } from '@/lib/auth/roles';
import { sanitizeReturnPath } from '@/lib/auth/safe-next';

/**
 * CSP con nonce por petición (spec §9). `strict-dynamic` deja que los scripts con
 * nonce carguen a los demás; en desarrollo React necesita `unsafe-eval`.
 */
export function buildCsp(
  nonce: string,
  options: { dev?: boolean } = {},
): string {
  const script = ["'self'", `'nonce-${nonce}'`, "'strict-dynamic'"];
  if (options.dev) script.push("'unsafe-eval'");
  return [
    "default-src 'self'",
    `script-src ${script.join(' ')}`,
    // Tailwind y los componentes de Radix escriben estilos en línea.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; ');
}

export function securityHeaders(options: {
  secure: boolean;
}): Record<string, string> {
  const headers: Record<string, string> = {
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'strict-origin-when-cross-origin',
    'X-Frame-Options': 'DENY',
    'Permissions-Policy':
      'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  };
  // HSTS solo tiene sentido (y solo se acepta) sobre HTTPS.
  if (options.secure)
    headers['Strict-Transport-Security'] =
      'max-age=63072000; includeSubDomains';
  return headers;
}

export function generateNonce(): string {
  return btoa(crypto.randomUUID());
}

export type GuardDecision =
  { action: 'next' } | { action: 'redirect'; to: string };

/**
 * Primera capa de guarda: en un prefijo privado, sin cookie de sesión → `/login?next=…`.
 * No valida el token (eso lo hace el layout con `/auth/me`).
 */
export function decideGuard(input: {
  pathname: string;
  search: string;
  hasSession: boolean;
}): GuardDecision {
  if (!isPrivatePath(input.pathname) || input.hasSession)
    return { action: 'next' };
  const next = sanitizeReturnPath(`${input.pathname}${input.search}`);
  return {
    action: 'redirect',
    to: next ? `/login?next=${encodeURIComponent(next)}` : '/login',
  };
}
