'use client';

import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { ErrorAlert } from '@/components/auth/error-alert';
import { Button } from '@/components/ui/button';
import type { Product } from '@/lib/catalog/types';
import { useCombosWith } from '@/lib/catalog/use-catalog';
import { useSetStatus } from '@/lib/catalog/use-product-actions';

/**
 * Activar o desactivar con confirmación en línea (D-117). Al desactivar un producto simple se
 * consultan los combos que lo contienen para avisar de cuáles dejarán de estar disponibles.
 */
export function StatusControl({
  product,
  onChanged,
  onMissing,
}: {
  product: Product;
  onChanged: (product: Product) => void;
  onMissing: (messages: string[]) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);
  const deactivating = product.active;
  const combos = useCombosWith(
    product.id,
    confirming && deactivating && product.category !== 'combo',
  );
  const action = useSetStatus({
    onDone: (updated) => {
      setConfirming(false);
      onChanged(updated);
    },
    onFail: (error) => {
      setConfirming(false);
      if (error.kind === 'missing') return onMissing(error.messages);
      setErrors(error.messages);
    },
  });
  const verb = deactivating ? 'Desactivar' : 'Activar';
  const Icon = deactivating ? EyeOff : Eye;

  if (!confirming)
    return (
      <div className="grid gap-2">
        <ErrorAlert messages={errors} />
        <Button
          type="button"
          variant="outline"
          className="min-h-12"
          aria-label={`${verb} ${product.name}`}
          onClick={() => {
            setErrors([]);
            setConfirming(true);
          }}
        >
          <Icon aria-hidden />
          {verb}
        </Button>
      </div>
    );

  const affected = combos.data ?? [];
  return (
    <div
      role="group"
      aria-label={`Confirmar ${verb.toLowerCase()} ${product.name}`}
      className="grid w-full gap-3 rounded-lg border p-4"
    >
      <p className="text-sm font-medium">
        {deactivating
          ? `¿Desactivar ${product.name}? Dejará de verse en el menú; conserva su saldo e historial.`
          : `¿Activar ${product.name}? Volverá al menú si tiene saldo.`}
      </p>
      {deactivating && product.category !== 'combo' ? (
        combos.isPending ? (
          <p className="text-sm text-muted-foreground" role="status">
            Revisando combos…
          </p>
        ) : affected.length > 0 ? (
          <p className="text-sm text-destructive" role="status">
            Es componente de {affected.map((c) => c.name).join(', ')}: esos
            combos dejarán de estar disponibles.
          </p>
        ) : null
      ) : null}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          className="min-h-12"
          disabled={action.pending}
          onClick={() => void action.run({ product, active: !product.active })}
        >
          {action.pending ? (
            <>
              <LoaderCircle className="animate-spin" aria-hidden />
              Guardando…
            </>
          ) : (
            `Sí, ${verb.toLowerCase()}`
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-12"
          disabled={action.pending}
          onClick={() => setConfirming(false)}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
