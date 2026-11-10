import 'server-only';
import { isIP } from 'node:net';

/**
 * IP del cliente según `X-Forwarded-For` (D-023). Se cuentan `hops` entradas desde
 * la derecha: las de la izquierda las puede escribir el propio cliente, las de la
 * derecha las añaden los proxies de confianza (Railway añade una).
 * Devuelve `null` si no hay que enviarla: sin confianza (`hops` = 0), sin cabecera,
 * con menos entradas que saltos o si el valor no es una IP.
 */
export function resolveClientIp(
  forwardedFor: string | null | undefined,
  hops: number,
): string | null {
  if (!forwardedFor || !Number.isInteger(hops) || hops <= 0) return null;
  const entries = forwardedFor.split(',').map((entry) => entry.trim());
  const candidate = entries[entries.length - hops];
  if (candidate === undefined || candidate === '') return null;
  return isIP(candidate) !== 0 ? candidate : null;
}
