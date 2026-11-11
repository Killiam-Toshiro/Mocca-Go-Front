const DATE = new Intl.DateTimeFormat('es-CO', {
  timeZone: 'America/Bogota',
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

/** «3 nov 2026» en hora de Bogotá. */
export function formatJoined(iso: string): string {
  return DATE.format(new Date(iso)).replace(/\./g, '');
}
