import type { Workbook, Worksheet } from 'exceljs';

export type Fmt =
  'text' | 'int' | 'cop' | 'pct' | 'min' | 'rating' | 'day' | 'datetime';

const NUM_FMT: Record<Fmt, string | undefined> = {
  text: undefined,
  int: '#,##0',
  cop: '"$"#,##0',
  pct: '0.0%',
  min: '0.0',
  rating: '0.0',
  day: 'yyyy-mm-dd',
  datetime: 'yyyy-mm-dd hh:mm',
};

export interface Column {
  header: string;
  fmt: Fmt;
  width: number;
}
export type Cell = string | number | Date | null | undefined;

/** Hoja con encabezado en negrita y fija, filtros y formatos de número; `null` queda vacío (no 0). */
export function addTable(
  book: Workbook,
  name: string,
  columns: Column[],
  rows: Cell[][],
): Worksheet {
  const sheet = book.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = columns.map((c) => ({ header: c.header, width: c.width }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) sheet.addRow(row.map((v) => v ?? null));
  columns.forEach((c, i) => {
    const fmt = NUM_FMT[c.fmt];
    if (fmt) sheet.getColumn(i + 1).numFmt = fmt;
  });
  sheet.getRow(1).numFmt = 'General';
  sheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: columns.length },
  };
  return sheet;
}

/** Hoja de dos columnas «Concepto / Valor» donde cada fila tiene su propio formato. */
export function addKeyValue(
  book: Workbook,
  name: string,
  rows: { label: string; value: Cell; fmt: Fmt }[],
): Worksheet {
  const sheet = book.addWorksheet(name, {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  sheet.columns = [
    { header: 'Concepto', width: 42 },
    { header: 'Valor', width: 28 },
  ];
  sheet.getRow(1).font = { bold: true };
  rows.forEach((r, i) => {
    const row = sheet.addRow([r.label, r.value ?? null]);
    const fmt = NUM_FMT[r.fmt];
    if (fmt) row.getCell(2).numFmt = fmt;
    row.getCell(2).alignment = { horizontal: 'right' };
    void i;
  });
  return sheet;
}
