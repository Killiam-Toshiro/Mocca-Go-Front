const DATE = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});
const TIME = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  hour: 'numeric',
  minute: '2-digit',
});

function parse(iso: string): Date | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** «10 nov, 12:31 p. m.» en hora de Bogotá. */
export function formatOrderDate(iso: string): string {
  const date = parse(iso);
  return date ? DATE.format(date) : '—';
}

/** Solo la hora, para la hora estimada de llegada. */
export function formatTime(iso: string): string {
  const date = parse(iso);
  return date ? TIME.format(date) : '—';
}

/** Solo se enlaza `https://wa.me/…` (D-045); cualquier otra cosa se descarta. */
export function safeWhatsappUrl(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname === 'wa.me'
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}
