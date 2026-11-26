/** Utilidades de paginación para la interfaz (el back pagina con `page` y `limit`). */

export type PageItem = number | 'gap-start' | 'gap-end';

/** Deja la página dentro de 1..total (con 0 páginas, la 1). */
export function clampPage(page: number, totalPages: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.trunc(page)), Math.max(1, totalPages));
}

export function totalPagesOf(total: number, pageSize: number): number {
  if (total <= 0 || pageSize <= 0) return 0;
  return Math.ceil(total / pageSize);
}

/**
 * Qué mostrar en la botonera: siempre la primera y la última, la actual con `siblings` vecinas a cada
 * lado y huecos («…») entre medias. Con pocas páginas se muestran todas.
 */
export function pageWindow(
  page: number,
  totalPages: number,
  siblings = 1,
): PageItem[] {
  if (totalPages <= 0) return [];
  const current = clampPage(page, totalPages);
  const slots = siblings * 2 + 5; // primera + última + actual + vecinas + 2 huecos
  const range = (from: number, to: number): number[] =>
    Array.from({ length: to - from + 1 }, (_, i) => from + i);
  if (totalPages <= slots) return range(1, totalPages);

  const leftSibling = Math.max(current - siblings, 1);
  const rightSibling = Math.min(current + siblings, totalPages);
  const gapLeft = leftSibling > 2;
  const gapRight = rightSibling < totalPages - 1;
  const edge = siblings * 2 + 3; // cuántas páginas se muestran pegadas a un extremo

  if (!gapLeft && gapRight) return [...range(1, edge), 'gap-end', totalPages];
  if (gapLeft && !gapRight)
    return [1, 'gap-start', ...range(totalPages - edge + 1, totalPages)];
  return [
    1,
    'gap-start',
    ...range(leftSibling, rightSibling),
    'gap-end',
    totalPages,
  ];
}

/** La porción de `items` que corresponde a la página (1 = primera). */
export function paginate<T>(
  items: readonly T[],
  page: number,
  pageSize: number,
): T[] {
  const totalPages = totalPagesOf(items.length, pageSize);
  const current = clampPage(page, totalPages);
  const start = (current - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/** «21–40 de 135» (o «0 resultados»). */
export function rangeLabel(
  page: number,
  pageSize: number,
  total: number,
): string {
  if (total <= 0) return '0 resultados';
  const totalPages = totalPagesOf(total, pageSize);
  const current = clampPage(page, totalPages);
  const from = (current - 1) * pageSize + 1;
  const to = Math.min(current * pageSize, total);
  return `${String(from)}–${String(to)} de ${String(total)}`;
}
