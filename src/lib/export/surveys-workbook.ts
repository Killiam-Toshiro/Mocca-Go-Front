import type { Workbook } from 'exceljs';
import type { SurveyRow } from '@/lib/surveys/use-surveys';
import { bogotaWallClock, dayToDate, safeText } from './cells';
import { addKeyValue, addTable } from './sheet';

export interface SurveysExportInfo {
  rating: number | null;
  from: string | null;
  to: string | null;
  /** Respuestas que cumplen el filtro, según el back. */
  total: number;
  /** `true` si el archivo trae solo las más recientes por el tope. */
  truncated: boolean;
  cap: number;
  generatedAt: number;
}

/** Libro con «Encuestas» (una fila por respuesta) y «Filtros» (lo aplicado y el aviso del tope). */
export function buildSurveysWorkbook(
  book: Workbook,
  rows: SurveyRow[],
  info: SurveysExportInfo,
): Workbook {
  addTable(
    book,
    'Encuestas',
    [
      { header: 'Fecha y hora (Colombia)', fmt: 'datetime', width: 22 },
      { header: 'Pedido', fmt: 'int', width: 10 },
      { header: 'Cliente', fmt: 'text', width: 26 },
      { header: 'Zona', fmt: 'text', width: 20 },
      { header: 'Calificación', fmt: 'int', width: 13 },
      { header: 'Comentario', fmt: 'text', width: 60 },
    ],
    rows.map((r) => [
      bogotaWallClock(r.createdAt),
      r.number,
      safeText(r.customer.name),
      safeText(r.zoneName),
      r.rating,
      safeText(r.comment),
    ]),
  );
  addKeyValue(book, 'Filtros', [
    {
      label: 'Calificación',
      value: info.rating === null ? 'Todas' : String(info.rating),
      fmt: 'text',
    },
    {
      label: 'Desde',
      value: info.from ? dayToDate(info.from) : null,
      fmt: 'day',
    },
    { label: 'Hasta', value: info.to ? dayToDate(info.to) : null, fmt: 'day' },
    {
      label: 'Respuestas que cumplen el filtro',
      value: info.total,
      fmt: 'int',
    },
    { label: 'Respuestas en el archivo', value: rows.length, fmt: 'int' },
    {
      label: 'Aviso',
      value: info.truncated
        ? `Hay más respuestas que el tope de ${String(info.cap)}: el archivo trae las ${String(info.cap)} más recientes.`
        : 'El archivo trae todas las respuestas del filtro.',
      fmt: 'text',
    },
    {
      label: 'Generado (hora de Colombia)',
      value: bogotaWallClock(info.generatedAt),
      fmt: 'datetime',
    },
  ]);
  return book;
}
