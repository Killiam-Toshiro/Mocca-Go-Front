import { todayBogota } from '@/lib/metrics/period';
import type { SurveyFilters } from '@/lib/surveys/filters';
import { downloadBlob, type SaveFile } from './download';
import { EXPORT_CAP, fetchAllSurveys } from './fetch-all-surveys';
import { surveysFileName, XLSX_TYPE } from './filename';
import { buildSurveysWorkbook } from './surveys-workbook';

/** Pide todas las respuestas del filtro, arma el Excel y lo guarda; devuelve el nombre (D-134). */
export async function exportSurveys(
  filters: Pick<SurveyFilters, 'rating' | 'from' | 'to'>,
  options: {
    signal?: AbortSignal;
    onProgress?: (done: number, total: number) => void;
    save?: SaveFile;
    cap?: number;
    now?: number;
  } = {},
): Promise<string> {
  const now = options.now ?? Date.now();
  const cap = options.cap ?? EXPORT_CAP;
  const all = await fetchAllSurveys(filters, {
    ...(options.signal ? { signal: options.signal } : {}),
    ...(options.onProgress ? { onProgress: options.onProgress } : {}),
    cap,
  });
  const { Workbook } = await import('exceljs');
  const book = buildSurveysWorkbook(new Workbook(), all.rows, {
    ...filters,
    total: all.total,
    truncated: all.truncated,
    cap,
    generatedAt: now,
  });
  const buffer = await book.xlsx.writeBuffer();
  options.signal?.throwIfAborted();
  const name = surveysFileName(todayBogota(new Date(now)));
  (options.save ?? downloadBlob)(new Blob([buffer], { type: XLSX_TYPE }), name);
  return name;
}
