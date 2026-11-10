import { cn } from '@/lib/utils';

/** Ícono de la marca: taza de café con vapor sobre un círculo naranja. Usa los tokens de color. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 96 96"
      aria-hidden="true"
      focusable="false"
      className={cn('size-9 shrink-0', className)}
    >
      <circle cx="48" cy="48" r="44" className="fill-brand" />
      <path
        d="M27 44h38v13a19 19 0 0 1-19 19h0a19 19 0 0 1-19-19z"
        className="fill-foreground"
      />
      <path
        d="M65 49h5a7.5 7.5 0 0 1 0 15h-5"
        className="fill-none stroke-foreground"
        strokeWidth="5"
        strokeLinecap="round"
      />
      <path
        d="M38 22c-4 4 4 7 0 12M48 22c-4 4 4 7 0 12M58 22c-4 4 4 7 0 12"
        className="fill-none stroke-foreground"
        strokeWidth="3.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Logo completo: ícono y nombre («Go» en el color de texto de marca). */
export function Logo({
  className,
  iconClassName,
  textClassName,
}: {
  className?: string;
  iconClassName?: string;
  textClassName?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark className={iconClassName} />
      <span
        className={cn(
          'font-display text-xl leading-none font-bold tracking-tight',
          textClassName,
        )}
      >
        Mocca <span className="text-brand-strong">Go</span>
      </span>
    </span>
  );
}
