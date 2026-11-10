'use client';

import { ShoppingBasket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useCart } from '@/lib/cart/use-cart';

/** Botón de la cabecera del menú: abre el carrito y muestra cuántas unidades hay. */
export function CartButton({ onClick }: { onClick: () => void }) {
  const cart = useCart();
  const units = cart.reduce((sum, line) => sum + line.quantity, 0);
  return (
    <Button
      type="button"
      variant="outline"
      aria-haspopup="dialog"
      aria-label={
        units > 0
          ? `Abrir carrito, ${units} ${units === 1 ? 'producto' : 'productos'}`
          : 'Abrir carrito'
      }
      onClick={onClick}
    >
      <ShoppingBasket aria-hidden />
      Carrito
      {units > 0 ? (
        <span
          aria-hidden
          className="rounded-full bg-primary px-2 text-xs font-bold text-primary-foreground"
        >
          {units}
        </span>
      ) : null}
    </Button>
  );
}
