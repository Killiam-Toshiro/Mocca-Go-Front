'use client';

import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatCardNumber, TEST_CARD } from '@/lib/orders/card';

/**
 * Tarjeta de demostración (D-038). El número vive solo en el estado de quien lo usa:
 * este componente no lo guarda en ningún lado.
 */
export function CardField({
  value,
  onChange,
  error,
  disabled,
}: {
  value: string;
  onChange: (next: string) => void;
  error?: string | undefined;
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-2">
      <FormField
        id="card-number"
        label="Número de tarjeta"
        error={error}
        hint="Tarjeta de prueba: 4242 4242 4242 4242 la aprueba."
      >
        {(control) => (
          <Input
            {...control}
            name="card-number"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="0000 0000 0000 0000"
            maxLength={19}
            disabled={disabled}
            value={formatCardNumber(value)}
            onChange={(event) => onChange(formatCardNumber(event.target.value))}
          />
        )}
      </FormField>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="justify-self-start"
        disabled={disabled}
        onClick={() => onChange(formatCardNumber(TEST_CARD))}
      >
        Usar tarjeta de prueba
      </Button>
    </div>
  );
}
