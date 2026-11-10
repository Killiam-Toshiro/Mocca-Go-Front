'use client';

import { useCartState } from '@/lib/cart/use-cart';

/** Región `aria-live` única: lee los cambios del carrito a quien usa lector de pantalla. */
export function CartAnnouncer() {
  const { announcement } = useCartState();
  return (
    <div role="status" aria-live="polite" className="sr-only">
      <span key={announcement.tick}>{announcement.text}</span>
    </div>
  );
}
