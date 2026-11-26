/** «hace 12 s», «hace 3 min»; menos de 5 s es «ahora». */
export function freshnessLabel(updatedAt: number, now: number): string {
  const seconds = Math.max(0, Math.floor((now - updatedAt) / 1000));
  if (seconds < 5) return 'Actualizado ahora';
  if (seconds < 60) return `Actualizado hace ${String(seconds)} s`;
  return `Actualizado hace ${String(Math.floor(seconds / 60))} min`;
}

/** Un pedido solo se identifica por su UUID: se muestran los últimos 6 caracteres (D-072). */
export function shortOrderId(orderId: string): string {
  return orderId.replace(/-/g, '').slice(-6);
}
