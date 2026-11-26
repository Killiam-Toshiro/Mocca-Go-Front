import type { Workbook } from 'exceljs';
import { categoryLabel } from '@/lib/menu/categories';
import type { Metrics } from '@/lib/metrics/types';
import { bogotaWallClock, dayToDate, safeText } from './cells';
import { addKeyValue, addTable } from './sheet';

export interface MetricsExportInfo {
  /** Nombre de la zona filtrada; `null` = todas. */
  zoneName: string | null;
  /** Cuándo se consultó (ms). */
  consultedAt: number;
}

/** Libro de Excel con las métricas visibles (D-133): resumen y una hoja por tabla, con números reales. */
export function buildMetricsWorkbook(
  book: Workbook,
  m: Metrics,
  info: MetricsExportInfo,
): Workbook {
  const t = m.delivery.totalMinutes;
  const s = m.delivery.stageMinutes;
  addKeyValue(book, 'Resumen', [
    { label: 'Periodo desde', value: dayToDate(m.period.from), fmt: 'day' },
    { label: 'Periodo hasta', value: dayToDate(m.period.to), fmt: 'day' },
    { label: 'Días del periodo', value: m.period.days, fmt: 'int' },
    {
      label: 'Zona',
      value: safeText(info.zoneName ?? 'Todas las zonas'),
      fmt: 'text',
    },
    {
      label: 'Consultado (hora de Colombia)',
      value: bogotaWallClock(info.consultedAt),
      fmt: 'datetime',
    },
    { label: 'Pedidos con pago aprobado', value: m.sales.orders, fmt: 'int' },
    { label: 'Ingresos', value: m.sales.revenue, fmt: 'cop' },
    {
      label: 'Ticket promedio',
      value: m.sales.orders === 0 ? null : m.sales.averageTicket,
      fmt: 'cop',
    },
    { label: 'Costo variable', value: m.margin.variableCost, fmt: 'cop' },
    { label: 'Margen', value: m.margin.margin, fmt: 'cop' },
    {
      label: 'Costo variable sobre ingresos',
      value: m.margin.variableCostRate,
      fmt: 'pct',
    },
    { label: 'Pedidos entregados', value: m.delivery.delivered, fmt: 'int' },
    { label: 'Entregados a tiempo', value: m.delivery.onTimeRate, fmt: 'pct' },
    {
      label: 'Umbral «a tiempo» (min de reparto)',
      value: m.delivery.onTimeThresholdMinutes,
      fmt: 'int',
    },
    { label: 'Tiempo total promedio (min)', value: t.average, fmt: 'min' },
    { label: 'Tiempo total mediano (min)', value: t.median, fmt: 'min' },
    { label: 'Tiempo total p90 (min)', value: t.p90, fmt: 'min' },
    { label: 'Etapa cocina promedio (min)', value: s.kitchen, fmt: 'min' },
    { label: 'Etapa espera promedio (min)', value: s.waiting, fmt: 'min' },
    { label: 'Etapa reparto promedio (min)', value: s.delivery, fmt: 'min' },
    {
      label: 'Respuestas de la encuesta',
      value: m.satisfaction.responses,
      fmt: 'int',
    },
    {
      label: 'Calificación promedio (de 5)',
      value: m.satisfaction.average,
      fmt: 'rating',
    },
    {
      label: 'Entregas que respondieron',
      value: m.satisfaction.responseRate,
      fmt: 'pct',
    },
    { label: 'Clientes', value: m.retention.customers, fmt: 'int' },
    {
      label: 'Clientes recurrentes',
      value: m.retention.repeatCustomers,
      fmt: 'int',
    },
    {
      label: 'Tasa de recompra',
      value: m.retention.customers === 0 ? null : m.retention.repeatRate,
      fmt: 'pct',
    },
    {
      label: 'Pedidos entregados (resultado)',
      value: m.outcomes.entregado,
      fmt: 'int',
    },
    {
      label: 'Pedidos no entregados',
      value: m.outcomes.no_entregado,
      fmt: 'int',
    },
    { label: 'Pedidos cancelados', value: m.outcomes.cancelado, fmt: 'int' },
    { label: 'Pedidos en curso', value: m.outcomes.enCurso, fmt: 'int' },
  ]);

  addTable(
    book,
    'Ventas por día',
    [
      { header: 'Fecha', fmt: 'day', width: 14 },
      { header: 'Pedidos', fmt: 'int', width: 12 },
      { header: 'Ingresos', fmt: 'cop', width: 16 },
    ],
    m.sales.daily.map((d) => [dayToDate(d.date), d.orders, d.revenue]),
  );

  addTable(
    book,
    'Margen por categoría',
    [
      { header: 'Categoría', fmt: 'text', width: 20 },
      { header: 'Ingresos', fmt: 'cop', width: 16 },
      { header: 'Costo variable', fmt: 'cop', width: 16 },
      { header: 'Margen', fmt: 'cop', width: 16 },
      { header: 'Costo variable sobre ingresos', fmt: 'pct', width: 18 },
    ],
    m.margin.byCategory.map((c) => [
      safeText(categoryLabel(c.category)),
      c.revenue,
      c.variableCost,
      c.margin,
      c.variableCostRate,
    ]),
  );

  addTable(
    book,
    'Entregas por zona',
    [
      { header: 'Zona', fmt: 'text', width: 24 },
      { header: 'Entregados', fmt: 'int', width: 12 },
      { header: 'A tiempo', fmt: 'pct', width: 12 },
      { header: 'Total promedio (min)', fmt: 'min', width: 14 },
      { header: 'Total mediano (min)', fmt: 'min', width: 14 },
      { header: 'Total p90 (min)', fmt: 'min', width: 14 },
      { header: 'Cocina (min)', fmt: 'min', width: 12 },
      { header: 'Espera (min)', fmt: 'min', width: 12 },
      { header: 'Reparto (min)', fmt: 'min', width: 12 },
    ],
    m.delivery.byZone.map((z) => [
      safeText(z.zoneName),
      z.delivered,
      z.onTimeRate,
      z.totalMinutes.average,
      z.totalMinutes.median,
      z.totalMinutes.p90,
      z.stageMinutes.kitchen,
      z.stageMinutes.waiting,
      z.stageMinutes.delivery,
    ]),
  );

  const d = m.satisfaction.distribution;
  addTable(
    book,
    'Satisfacción',
    [
      { header: 'Calificación', fmt: 'int', width: 14 },
      { header: 'Respuestas', fmt: 'int', width: 14 },
    ],
    ([1, 2, 3, 4, 5] as const).map((n) => [n, d[String(n) as '1']]),
  );
  return book;
}
