import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { NavItem } from '@/lib/auth/nav';

/** Lista de enlaces de un rol; lo que aún no existe se ve, pero no es un enlace. */
export function NavList({
  items,
  pathname,
  onNavigate,
}: {
  items: NavItem[];
  pathname: string;
  onNavigate?: () => void;
}) {
  const base = 'flex h-10 items-center rounded-md px-3 text-sm font-medium';
  return (
    <ul className="grid gap-1">
      {items.map((item) =>
        item.enabled ? (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={pathname === item.href ? 'page' : undefined}
              className={cn(
                base,
                'outline-none focus-visible:ring-2 focus-visible:ring-ring',
                pathname === item.href
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-accent',
              )}
            >
              {item.label}
            </Link>
          </li>
        ) : (
          <li key={item.href}>
            <span
              aria-disabled="true"
              className={cn(base, 'justify-between text-muted-foreground')}
            >
              {item.label}
              <span className="text-xs font-normal">Próximamente</span>
            </span>
          </li>
        ),
      )}
    </ul>
  );
}
