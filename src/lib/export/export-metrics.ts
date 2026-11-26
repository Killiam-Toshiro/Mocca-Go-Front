import type { Metrics } from '@/lib/metrics/types';
import { downloadBlob, type SaveFile } from './download';
import { metricsFileName, XLSX_TYPE } from './filename';
import { buildMetricsWorkbook } from './metrics-workbook';

/** Arma el Excel de las métricas ya cargadas y lo guarda; devuelve el nombre del archivo (D-133). */
export async function exportMetrics(
  metrics: Metrics,
  options: {
    zoneName: string | null;
    consultedAt: number;
    save?: SaveFile;
  },
): Promise<string> {
  // La librería solo se descarga al pulsar el botón.
  const { Workbook } = await import('exceljs');
  const book = buildMetricsWorkbook(new Workbook(), metrics, options);
  const buffer = await book.xlsx.writeBuffer();
  const name = metricsFileName(
    metrics.period.from,
    metrics.period.to,
    options.zoneName,
  );
  (options.save ?? downloadBlob)(new Blob([buffer], { type: XLSX_TYPE }), name);
  return name;
}
