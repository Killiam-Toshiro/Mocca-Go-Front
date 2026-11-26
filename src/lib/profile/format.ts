const LONG_DATE = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

/** «3 de noviembre de 2026» en hora de Bogotá; «—» si la fecha no es válida. */
export function memberSince(iso: string): string {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? '—' : LONG_DATE.format(date);
}
