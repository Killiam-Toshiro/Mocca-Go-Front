import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { MAX_QUANTITY } from '@/lib/cart/cart';

/** Selector de cantidad con botones de 44 px; la cantidad se anuncia con `<output>`. */
export function QuantityStepper({
  value,
  onChange,
  label,
  min = 1,
  max = MAX_QUANTITY,
}: {
  value: number;
  onChange: (next: number) => void;
  /** Producto al que se refiere (para los nombres accesibles). */
  label: string;
  min?: number;
  max?: number;
}) {
  return (
    <div className="inline-flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`Quitar una unidad de ${label}`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        <Minus aria-hidden />
      </Button>
      <output
        aria-label={`Cantidad de ${label}`}
        className="min-w-8 text-center font-semibold tabular-nums"
      >
        {value}
      </output>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={`Agregar una unidad de ${label}`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        <Plus aria-hidden />
      </Button>
    </div>
  );
}
