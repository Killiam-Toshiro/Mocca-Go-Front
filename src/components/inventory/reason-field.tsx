'use client';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { REASON_MAX } from '@/lib/inventory/movement';

/** Campo «Motivo» con contador y motivos sugeridos que lo rellenan (siguen siendo editables). */
export function ReasonField({
  id,
  value,
  onChange,
  error,
  suggestions,
  label = 'Motivo',
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  suggestions: string[];
  label?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div
        className="flex flex-wrap gap-2"
        role="group"
        aria-label="Motivos sugeridos"
      >
        {suggestions.map((text) => (
          <button
            key={text}
            type="button"
            aria-pressed={value === text}
            onClick={() => onChange(text)}
            className="min-h-10 rounded-full border bg-card px-3 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            {text}
          </button>
        ))}
      </div>
      <Input
        id={id}
        autoComplete="off"
        className="h-12 text-base"
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={`${error ? `${id}-error ` : ''}${id}-count`}
        onChange={(e) => onChange(e.target.value)}
      />
      {error ? (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <p
        id={`${id}-count`}
        className="text-sm text-muted-foreground tabular-nums"
      >
        {value.length}/{REASON_MAX}
      </p>
    </div>
  );
}
