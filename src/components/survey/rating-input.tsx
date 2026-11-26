'use client';

import { Star } from 'lucide-react';
import { RATINGS, ratingLabel, ratingSummary } from '@/lib/survey/rating';
import { cn } from '@/lib/utils';

/**
 * Calificación de 1 a 5 como grupo de opciones nativo (flechas del teclado, un nombre por opción),
 * con estrellas de 48 px y la etiqueta de texto de la elegida (D-046: nunca solo ícono).
 */
export function RatingInput({
  value,
  onChange,
  disabled = false,
  name,
  error,
}: {
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
  name: string;
  error?: string | undefined;
}) {
  const errorId = `${name}-error`;
  return (
    <fieldset
      className="grid gap-2"
      disabled={disabled}
      aria-describedby={error ? errorId : undefined}
    >
      <legend className="mb-1 text-sm font-medium">Tu calificación</legend>
      <div className="flex gap-1">
        {RATINGS.map(({ value: n }) => {
          const filled = value !== null && n <= value;
          return (
            <label
              key={n}
              className={cn(
                'relative flex size-12 cursor-pointer items-center justify-center rounded-lg',
                'has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                disabled && 'cursor-not-allowed opacity-60',
              )}
            >
              <input
                type="radio"
                name={name}
                value={n}
                checked={value === n}
                onChange={() => onChange(n)}
                className="peer sr-only"
              />
              <span className="sr-only">{ratingSummary(n)}</span>
              <Star
                aria-hidden
                className={cn(
                  'size-9',
                  filled
                    ? 'fill-primary stroke-primary'
                    : 'stroke-muted-foreground',
                )}
              />
            </label>
          );
        })}
      </div>
      <p className="min-h-5 text-sm font-medium" aria-hidden={value === null}>
        {value === null ? 'Elige de 1 a 5 estrellas' : ratingSummary(value)}
      </p>
      {error ? (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}

/** Estrellas de solo lectura con su texto («4 de 5 · Buena»). */
export function RatingStars({ value }: { value: number }) {
  return (
    <p className="flex flex-wrap items-center gap-2">
      <span aria-hidden className="flex">
        {RATINGS.map(({ value: n }) => (
          <Star
            key={n}
            className={cn(
              'size-6',
              n <= value
                ? 'fill-primary stroke-primary'
                : 'stroke-muted-foreground',
            )}
          />
        ))}
      </span>
      <span className="font-semibold">{`${String(value)} de 5 · ${ratingLabel(value)}`}</span>
    </p>
  );
}
