import type { MovementType, StaffProduct } from './types';

export const TARGET_MAX = 100_000;

export type ParsedTarget =
  { ok: true; value: number | null } | { ok: false; error: string };

/** «Para hoy»: vacío no cambia nada; si no, un entero de 0 a 100 000 (D-083). */
export function parseTarget(text: string): ParsedTarget {
  const raw = text.trim();
  if (raw === '') return { ok: true, value: null };
  if (!/^(0|[1-9][0-9]{0,5})$/.test(raw))
    return {
      ok: false,
      error: 'Escribe un número entero de 0 en adelante, sin decimales.',
    };
  const value = Number(raw);
  if (value > TARGET_MAX)
    return { ok: false, error: `El máximo es ${String(TARGET_MAX)}.` };
  return { ok: true, value };
}

export interface PlanRow {
  id: string;
  name: string;
  current: number;
  target: number;
  delta: number;
  type: MovementType;
  quantity: number;
}

/** Productos que se pueden preparar: simples y activos (los combos se calculan, D-071). */
export function preparable(products: StaffProduct[]): StaffProduct[] {
  return products.filter((p) => p.active && p.category !== 'combo');
}

/**
 * Lo que hay que mover para llegar a «Para hoy»: sube → `IN`, baja → `OUT`, igual → fuera.
 * El back solo suma y resta, así que la diferencia sale del saldo vigente (D-079).
 */
export function buildPlan(
  products: StaffProduct[],
  targets: Record<string, string>,
): PlanRow[] {
  const rows: PlanRow[] = [];
  for (const product of preparable(products)) {
    const parsed = parseTarget(targets[product.id] ?? '');
    if (!parsed.ok || parsed.value === null) continue;
    const delta = parsed.value - product.stock;
    if (delta === 0) continue;
    rows.push({
      id: product.id,
      name: product.name,
      current: product.stock,
      target: parsed.value,
      delta,
      type: delta > 0 ? 'IN' : 'OUT',
      quantity: Math.abs(delta),
    });
  }
  return rows;
}

export interface PlanSummary {
  total: number;
  up: number;
  down: number;
  unitsUp: number;
  unitsDown: number;
}

export function summarize(plan: PlanRow[]): PlanSummary {
  const up = plan.filter((r) => r.type === 'IN');
  const down = plan.filter((r) => r.type === 'OUT');
  return {
    total: plan.length,
    up: up.length,
    down: down.length,
    unitsUp: up.reduce((n, r) => n + r.quantity, 0),
    unitsDown: down.reduce((n, r) => n + r.quantity, 0),
  };
}

/** «12 productos: 9 suben, 3 bajan». */
export function summaryText(summary: PlanSummary): string {
  const noun = summary.total === 1 ? 'producto' : 'productos';
  const parts: string[] = [];
  if (summary.up > 0)
    parts.push(`${String(summary.up)} ${summary.up === 1 ? 'sube' : 'suben'}`);
  if (summary.down > 0)
    parts.push(
      `${String(summary.down)} ${summary.down === 1 ? 'baja' : 'bajan'}`,
    );
  return `${String(summary.total)} ${noun}: ${parts.join(', ')}`;
}

/** Hay errores de formato en alguno de los campos con texto. */
export function targetErrors(
  products: StaffProduct[],
  targets: Record<string, string>,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const product of preparable(products)) {
    const parsed = parseTarget(targets[product.id] ?? '');
    if (!parsed.ok) errors[product.id] = parsed.error;
  }
  return errors;
}
