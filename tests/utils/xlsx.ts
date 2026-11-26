import { Workbook } from 'exceljs';

/** Lee un `Blob` .xlsx generado por la app y devuelve el libro (para comprobar hojas y valores). */
export async function readXlsx(blob: Blob): Promise<Workbook> {
  const buffer = await new Promise<ArrayBuffer>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
  const book = new Workbook();
  await book.xlsx.load(buffer);
  return book;
}
