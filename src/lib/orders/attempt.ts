import { readSession, removeSession, writeSession } from './session-store';

export const ATTEMPT_KEY = 'mocca-go:order-attempt:v1';

interface Attempt {
  key: string;
  fingerprint: string;
}

function read(): Attempt | null {
  const raw = readSession(ATTEMPT_KEY);
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as Partial<Attempt>;
    return typeof value.key === 'string' &&
      typeof value.fingerprint === 'string'
      ? { key: value.key, fingerprint: value.fingerprint }
      : null;
  } catch {
    return null;
  }
}

/**
 * `Idempotency-Key` del intento (D-040): se reutiliza si el contenido es el mismo
 * (reintento tras un fallo de red) y cambia si el cliente modificó algo.
 */
export function getAttemptKey(fingerprint: string): string {
  const saved = read();
  if (saved && saved.fingerprint === fingerprint) return saved.key;
  const key = crypto.randomUUID();
  writeSession(ATTEMPT_KEY, JSON.stringify({ key, fingerprint }));
  return key;
}

export function clearAttempt(): void {
  removeSession(ATTEMPT_KEY);
}
