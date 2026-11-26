'use client';

import { Button } from '@/components/ui/button';
import { reconcile } from '@/lib/cart/cart';
import { useCart } from '@/lib/cart/use-cart';
import type { MenuItem } from '@/lib/menu/categories';
import { formatCOP } from '@/lib/menu/format';

/** Barra inferior solo en móvil: resume cantidad y total y abre el carrito. */
export function CartBar({
  menu,
  onClick,
}: {
  menu: readonly MenuItem[] | undefined;
  onClick: () => void;
}) {
  const cart = useCart();
  const view = reconcile(cart, menu);
  if (view.units === 0) return null;
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t bg-card p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] md:hidden">
      <Button
        type="button"
        className="h-12 w-full justify-between text-base"
        aria-haspopup="dialog"
        onClick={onClick}
      >
        <span>Ver carrito · {view.units}</span>
        {menu ? <span>{formatCOP(view.subtotal)}</span> : null}
      </Button>
    </div>
  );
}
