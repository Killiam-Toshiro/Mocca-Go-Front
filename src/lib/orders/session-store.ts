const memory = new Map<string, string>();
let degraded = false;

/**
 * `sessionStorage` con respaldo en memoria (modo privado, bloqueado o lleno).
 * Solo para datos NO sensibles: la tarjeta nunca pasa por aquí (D-038).
 */
export function readSession(key: string): string | null {
  if (degraded) return memory.get(key) ?? null;
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    degraded = true;
    return memory.get(key) ?? null;
  }
}

export function writeSession(key: string, value: string): void {
  memory.set(key, value);
  if (degraded) return;
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    degraded = true;
  }
}

export function removeSession(key: string): void {
  memory.delete(key);
  if (degraded) return;
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    degraded = true;
  }
}

/** Solo para pruebas. */
export function resetSessionStoreForTests(): void {
  memory.clear();
  degraded = false;
}
