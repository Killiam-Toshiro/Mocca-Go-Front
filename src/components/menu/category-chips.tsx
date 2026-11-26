import { categoryLabel } from '@/lib/menu/categories';
import { cn } from '@/lib/utils';

/** Filtro por categoría: «Todo» y una pestaña por categoría presente en el menú. */
export function CategoryChips({
  categories,
  selected,
  onSelect,
}: {
  categories: readonly string[];
  /** `null` = todo. */
  selected: string | null;
  onSelect: (category: string | null) => void;
}) {
  const options: { value: string | null; label: string }[] = [
    { value: null, label: 'Todo' },
    ...categories.map((value) => ({ value, label: categoryLabel(value) })),
  ];
  return (
    <nav aria-label="Categorías">
      <ul className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:flex-wrap md:px-0">
        {options.map(({ value, label }) => {
          const active = value === selected;
          return (
            <li key={value ?? 'todo'} className="shrink-0">
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(value)}
                className={cn(
                  'inline-flex h-11 items-center rounded-full border px-4 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                  active
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-input bg-card hover:bg-accent',
                )}
              >
                {label}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
