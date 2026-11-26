import { isIsoDay, validatePeriod } from '@/lib/metrics/period';

export const SURVEYS_PAGE_SIZE = 20;
export const RATING_FILTERS = [1, 2, 3, 4, 5] as const;

export interface SurveyFilters {
  page: number;
  rating: number | null;
  from: string | null;
  to: string | null;
  /** Problema de las fechas escritas en la URL (no se consulta al back). */
  error: string | null;
}

interface ParamsLike {
  get(name: string): string | null;
}

/** Lee `?page=&rating=&from=&to=` con valores seguros (lo inválido se ignora). */
export function parseSurveyFilters(params: ParamsLike): SurveyFilters {
  const page = Number(params.get('page'));
  const rating = Number(params.get('rating'));
  const rawFrom = params.get('from');
  const rawTo = params.get('to');
  const from = isIsoDay(rawFrom) ? rawFrom : null;
  const to = isIsoDay(rawTo) ? rawTo : null;
  return {
    page: Number.isInteger(page) && page >= 1 && page <= 10000 ? page : 1,
    rating:
      Number.isInteger(rating) && rating >= 1 && rating <= 5 ? rating : null,
    from,
    to,
    error: from && to ? validatePeriod(from, to) : null,
  };
}

/** Parámetros para la URL de la pantalla (omite lo vacío y la página 1). */
export function surveyParams(f: Omit<SurveyFilters, 'error'>): URLSearchParams {
  const q = new URLSearchParams();
  if (f.rating) q.set('rating', String(f.rating));
  if (f.from) q.set('from', f.from);
  if (f.to) q.set('to', f.to);
  if (f.page > 1) q.set('page', String(f.page));
  return q;
}

export function hasSurveyFilters(f: SurveyFilters): boolean {
  return f.rating !== null || f.from !== null || f.to !== null;
}

/** Texto de la calificación para lectores de pantalla y color aparte: «4 de 5». */
export function ratingText(rating: number): string {
  return `${String(rating)} de 5`;
}
