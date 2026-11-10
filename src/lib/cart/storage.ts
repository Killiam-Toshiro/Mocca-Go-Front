/** Clave versionada del carrito en el navegador (D-029). */
export const CART_KEY = 'mocca-go:cart:v1';

let memory: string | null = null;
let degraded = false;

/**
 * Lee y escribe `localStorage` con respaldo en memoria: en modo privado, con el
 * almacenamiento lleno o bloqueado, el carrito sigue funcionando hasta cerrar la pestaña.
 */
export function readRaw(): string | null {
  if (degraded) return memory;
  try {
    return window.localStorage.getItem(CART_KEY);
  } catch {
    degraded = true;
    return memory;
  }
}

export function writeRaw(value: string): void {
  memory = value;
  if (degraded) return;
  try {
    window.localStorage.setItem(CART_KEY, value);
  } catch {
    degraded = true;
  }
}

export function clearRaw(): void {
  memory = null;
  if (degraded) return;
  try {
    window.localStorage.removeItem(CART_KEY);
  } catch {
    degraded = true;
  }
}

/** Solo para pruebas. */
export function resetStorageForTests(): void {
  memory = null;
  degraded = false;
}
