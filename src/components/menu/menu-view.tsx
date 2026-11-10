'use client';

import { useEffect, useState } from 'react';
import { CartAnnouncer } from '@/components/cart/cart-announcer';
import { CartBar } from '@/components/cart/cart-bar';
import { CartButton } from '@/components/cart/cart-button';
import { CartPanel, type Audience } from '@/components/cart/cart-panel';
import { CategoryChips } from '@/components/menu/category-chips';
import { ProductCard } from '@/components/menu/product-card';
import { ProductDetail } from '@/components/menu/product-detail';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { describeApiError } from '@/lib/api/errors';
import { addToCart, syncWithMenu } from '@/lib/cart/store';
import { useCart } from '@/lib/cart/use-cart';
import {
  categoryLabel,
  groupByCategory,
  type MenuItem,
} from '@/lib/menu/categories';
import { useMenu } from '@/lib/menu/use-menu';

/** Menú con filtro por categoría, detalle y carrito. Lo usan `/` y `/cliente/menu`. */
export function MenuView({ audience }: { audience: Audience }) {
  const canOrder = audience !== 'personal';
  const query = useMenu();
  const cart = useCart();
  const [category, setCategory] = useState<string | null>(null);
  const [detail, setDetail] = useState<MenuItem | null>(null);
  const [cartOpen, setCartOpen] = useState(false);

  const menu = query.data;
  useEffect(() => {
    if (menu) syncWithMenu(menu);
  }, [menu]);

  const groups = menu ? groupByCategory(menu) : [];
  const present = groups.map((group) => group.category);
  const active = category && present.includes(category) ? category : null;
  const shown = active
    ? groups.filter((group) => group.category === active)
    : groups;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6">
      <CartAnnouncer />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-display text-3xl font-semibold">Menú</h1>
        {canOrder ? <CartButton onClick={() => setCartOpen(true)} /> : null}
      </div>

      {query.isPending ? (
        <div
          aria-busy="true"
          aria-label="Cargando el menú"
          className="grid gap-3"
        >
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : query.isError ? (
        <Alert variant="destructive" className="grid gap-2">
          {describeApiError(query.error).map((line) => (
            <p key={line}>{line}</p>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="justify-self-start"
            onClick={() => void query.refetch()}
          >
            Reintentar
          </Button>
        </Alert>
      ) : groups.length === 0 ? (
        <p className="text-muted-foreground">
          Hoy no hay productos disponibles.
        </p>
      ) : (
        <>
          <CategoryChips
            categories={present}
            selected={active}
            onSelect={setCategory}
          />
          {shown.map((group) => (
            <section
              key={group.category}
              className="grid grid-cols-[minmax(0,1fr)] gap-3"
            >
              <h2 className="font-display text-xl font-semibold">
                {categoryLabel(group.category)}
              </h2>
              <ul className="grid gap-3 md:grid-cols-2">
                {group.items.map((item) => (
                  <ProductCard
                    key={item.id}
                    item={item}
                    canOrder={canOrder}
                    onOpen={setDetail}
                    onAdd={(product) => addToCart(product, 1)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </>
      )}

      <ProductDetail
        item={detail}
        canOrder={canOrder}
        cart={cart}
        onClose={() => setDetail(null)}
        onAdd={(item, quantity) => addToCart(item, quantity)}
      />
      {canOrder ? (
        <>
          <CartPanel
            open={cartOpen}
            onClose={() => setCartOpen(false)}
            audience={audience}
            menu={menu}
            menuFailed={query.isError}
            onRetry={() => void query.refetch()}
          />
          <CartBar menu={menu} onClick={() => setCartOpen(true)} />
          <div className="h-16 md:hidden" aria-hidden />
        </>
      ) : null}
    </div>
  );
}
