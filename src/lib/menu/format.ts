/**
 * Pesos colombianos sin decimales y con punto de miles: `4500` → `$4.500`.
 * Se arma a mano porque `Intl` cambia el espacio y el separador según el entorno (D-035).
 */
export function formatCOP(amount: number): string {
  const rounded = Math.round(amount);
  const sign = rounded < 0 ? '-' : '';
  const digits = Math.abs(rounded)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}$${digits}`;
}
