import type { ReconciledCart } from '@/lib/cart/cart';
import { formatCOP } from '@/lib/menu/format';

/** Resumen del carrito en la página de pedido. El total es estimado: el back lo recalcula. */
export function OrderSummary({ view }: { view: ReconciledCart }) {
  return (
    <section
      aria-labelledby="resumen-titulo"
      className="grid gap-3 rounded-xl border bg-card p-4"
    >
      <h2 id="resumen-titulo" className="font-display text-xl font-semibold">
        Resumen
      </h2>
      <ul className="grid gap-2">
        {view.rows.map((row) => (
          <li
            key={row.line.productId}
            className="flex items-baseline justify-between gap-3 text-sm"
          >
            <span>
              {row.line.quantity} × {row.item?.name ?? row.line.name}
              {row.status === 'agotado' ? (
                <span className="ml-2 font-semibold text-destructive">
                  Agotado
                </span>
              ) : null}
              {row.status === 'retirado' ? (
                <span className="ml-2 font-semibold text-destructive">
                  Ya no está en el menú
                </span>
              ) : null}
            </span>
            <span className="tabular-nums">
              {row.status === 'ok' ? formatCOP(row.lineTotal) : '—'}
            </span>
          </li>
        ))}
      </ul>
      <div className="flex items-baseline justify-between border-t pt-3">
        <span className="font-semibold">Total estimado</span>
        <span className="text-xl font-semibold tabular-nums">
          {formatCOP(view.subtotal)}
        </span>
      </div>
    </section>
  );
}
