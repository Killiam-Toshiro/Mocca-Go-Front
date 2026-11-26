/** Solo letras, números y guiones: sin tildes, espacios ni símbolos que un sistema de archivos rechace. */
export function slug(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
}

export function metricsFileName(
  from: string,
  to: string,
  zoneName: string | null,
): string {
  const zone = zoneName ? slug(zoneName) : '';
  return `mocca-go-metricas_${from}_a_${to}${zone ? `_${zone}` : ''}.xlsx`;
}

export function surveysFileName(today: string): string {
  return `mocca-go-encuestas_${today}.xlsx`;
}

export const XLSX_TYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
