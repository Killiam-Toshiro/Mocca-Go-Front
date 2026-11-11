export const COMMENT_MAX = 300;

/** Etiquetas de texto de las 5 opciones (nunca solo estrellas ni solo color; D-046). */
export const RATINGS = [
  { value: 1, label: 'Muy mala' },
  { value: 2, label: 'Mala' },
  { value: 3, label: 'Regular' },
  { value: 4, label: 'Buena' },
  { value: 5, label: 'Excelente' },
] as const;

export function ratingLabel(value: number): string {
  return RATINGS.find((r) => r.value === value)?.label ?? '';
}

/** «4 de 5 · Buena». */
export function ratingSummary(value: number): string {
  return `${String(value)} de 5 · ${ratingLabel(value)}`;
}

/** Recorta el comentario; el back no acepta un comentario vacío (es opcional, no vacío). */
export function cleanComment(text: string): string | undefined {
  const trimmed = text.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function surveyBody(
  rating: number,
  comment: string,
): { rating: number; comment?: string } {
  const clean = cleanComment(comment);
  return clean === undefined ? { rating } : { rating, comment: clean };
}

export function isRating(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 5;
}
