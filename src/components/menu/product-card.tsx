import { Plus } from 'lucide-react';
import { CategoryIcon } from '@/components/menu/category-icon';
import { Button } from '@/components/ui/button';
import type { MenuItem } from '@/lib/menu/categories';
import { formatCOP } from '@/lib/menu/format';
import { cn } from '@/lib/utils';

/** Tarjeta de un producto: abre el detalle y, si se puede pedir, agrega una unidad. */
export function ProductCard({
  item,
  canOrder,
  onOpen,
  onAdd,
}: {
  item: MenuItem;
  canOrder: boolean;
  onOpen: (item: MenuItem) => void;
  onAdd: (item: MenuItem) => void;
}) {
  return (
    <li className="flex items-stretch gap-2 rounded-xl border bg-card p-3 shadow-sm">
      <button
        type="button"
        onClick={() => onOpen(item)}
        aria-haspopup="dialog"
        className="flex min-w-0 flex-1 items-start gap-3 rounded-lg text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span
          className={cn(
            'flex size-12 shrink-0 items-center justify-center rounded-lg bg-secondary text-brand-strong',
            !item.available && 'opacity-60',
          )}
        >
          <CategoryIcon category={item.category} />
        </span>
        <span className="grid min-w-0 gap-0.5">
          <span className="font-semibold">{item.name}</span>
          {item.description ? (
            <span className="line-clamp-2 text-sm text-muted-foreground">
              {item.description}
            </span>
          ) : null}
          <span className="mt-1 flex items-center gap-2">
            <span className="font-semibold">{formatCOP(item.price)}</span>
            {!item.available ? (
              <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">
                Agotado
              </span>
            ) : null}
          </span>
        </span>
      </button>
      {canOrder && item.available ? (
        <Button
          type="button"
          size="icon"
          className="size-11 shrink-0 self-center"
          aria-label={`Agregar ${item.name} al carrito`}
          onClick={() => onAdd(item)}
        >
          <Plus aria-hidden />
        </Button>
      ) : null}
    </li>
  );
}
