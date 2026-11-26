import { requestJson } from '@/lib/api/json';
import type { SurveyFilters } from '@/lib/surveys/filters';
import {
  surveysUrl,
  type SurveyPage,
  type SurveyRow,
} from '@/lib/surveys/use-surveys';

export const EXPORT_PAGE_SIZE = 100;
export const EXPORT_CAP = 10_000;

export interface AllSurveys {
  rows: SurveyRow[];
  /** Total que cumple el filtro, según el back. */
  total: number;
  /** Hay más que el tope: `rows` trae las más recientes. */
  truncated: boolean;
}

/**
 * Pide las respuestas del filtro de 100 en 100 (el máximo del back), una página a la vez para no
 * saturarlo, hasta completar o llegar al tope (D-134). Cancelable; sin páginas a medias: si algo
 * falla, lanza y no devuelve nada.
 */
export async function fetchAllSurveys(
  filters: Pick<SurveyFilters, 'rating' | 'from' | 'to'>,
  options: {
    signal?: AbortSignal;
    onProgress?: (done: number, total: number) => void;
    cap?: number;
  } = {},
): Promise<AllSurveys> {
  const cap = options.cap ?? EXPORT_CAP;
  const rows: SurveyRow[] = [];
  const seen = new Set<string>();
  let total = 0;
  let totalPages = 1;
  for (let page = 1; page <= totalPages && rows.length < cap; page++) {
    options.signal?.throwIfAborted();
    const body = await requestJson<SurveyPage>(
      surveysUrl({ ...filters, page, error: null }, EXPORT_PAGE_SIZE),
      {
        method: 'GET',
        handleUnauthorized: true,
        ...(options.signal ? { signal: options.signal } : {}),
      },
    );
    total = body.total;
    totalPages = body.totalPages;
    for (const row of body.data) {
      // Si llega una respuesta nueva mientras se pagina, las páginas se corren: no se repite ninguna.
      if (!seen.has(row.orderId)) {
        seen.add(row.orderId);
        rows.push(row);
      }
    }
    options.onProgress?.(Math.min(rows.length, cap), Math.min(total, cap));
  }
  options.signal?.throwIfAborted();
  return {
    rows: rows.slice(0, cap),
    total,
    truncated: total > cap,
  };
}
