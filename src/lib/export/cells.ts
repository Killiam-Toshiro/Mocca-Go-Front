/**
 * Texto de un cliente o de un nombre escrito por personas, listo para una hoja de cálculo (D-135):
 * si empieza con `=`, `+`, `-`, `@`, tabulador o salto de línea, una hoja podría ejecutarlo como
 * fórmula; se le pone una comilla simple delante. Vacío o `null` → celda vacía.
 */
export function safeText(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined || value === '') return undefined;
  return /^[=+\-@\t\r\n]/.test(value) ? `'${value}` : value;
}

/** `2026-11-05` → fecha de Excel a medianoche UTC (se muestra como `2026-11-05`). */
export function dayToDate(day: string): Date {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
}

/**
 * Instante → «hora de pared» de Colombia. Excel no guarda zona horaria: se corre el instante −5 h
 * para que, al mostrarlo como UTC, se lea la hora de Colombia.
 */
export function bogotaWallClock(iso: string | number): Date {
  const ms = typeof iso === 'number' ? iso : Date.parse(iso);
  return new Date(ms - 5 * 3_600_000);
}
