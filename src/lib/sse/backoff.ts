export const BACKOFF_BASE_MS = 1_000;
export const BACKOFF_MAX_MS = 30_000;

/** Espera antes del intento `attempt` (0, 1, 2…): 1 s, 2 s, 4 s… hasta 30 s, con ±20 % de variación. */
export function nextDelay(
  attempt: number,
  random: () => number = Math.random,
): number {
  const base = Math.min(
    BACKOFF_MAX_MS,
    BACKOFF_BASE_MS * 2 ** Math.max(0, attempt),
  );
  const jitter = 1 + (random() * 2 - 1) * 0.2;
  return Math.min(BACKOFF_MAX_MS, Math.round(base * jitter));
}
