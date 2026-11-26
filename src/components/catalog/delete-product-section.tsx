'use client';

import { LoaderCircle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ErrorAlert } from '@/components/auth/error-alert';
import { Button } from '@/components/ui/button';
import type { Product } from '@/lib/catalog/types';
import { useDeleteProduct } from '@/lib/catalog/use-product-actions';
import { CatalogNotice } from './catalog-notice';
import { StatusControl } from './status-control';

/**
 * Eliminar con confirmación en línea (DP-08). Los 409 se explican con el texto del back y se
 * ofrece desactivar (con su propia confirmación) como alternativa.
 */
export function DeleteProductSection({
  product,
  onDeleted,
  onStatusChanged,
  onMissing,
}: {
  product: Product;
  onDeleted: () => void;
  onStatusChanged: (product: Product) => void;
  onMissing: (messages: string[]) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [conflict, setConflict] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const remove = useDeleteProduct({
    onDone: () => onDeleted(),
    onFail: (error) => {
      setConfirming(false);
      if (error.kind === 'missing') return onMissing(error.messages);
      if (error.kind === 'conflict') return setConflict(error.messages);
      setErrors(error.messages);
    },
  });

  return (
    <section aria-label="Eliminar producto" className="grid gap-3">
      <h3 className="font-semibold">Eliminar producto</h3>
      <p className="text-sm text-muted-foreground">
        Solo se puede eliminar si no tiene movimientos ni es componente de un
        combo; si no, desactívalo.
      </p>
      <ErrorAlert messages={errors} />
      <CatalogNotice messages={conflict} onDismiss={() => setConflict([])} />
      {conflict.length > 0 && product.active ? (
        <StatusControl
          product={product}
          onChanged={onStatusChanged}
          onMissing={onMissing}
        />
      ) : null}
      {confirming ? (
        <div
          role="group"
          aria-label="Confirmar eliminación"
          className="grid gap-3 rounded-lg border border-destructive/50 p-4"
        >
          <p className="text-sm font-medium">
            ¿Eliminar {product.name}? No se puede deshacer.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="destructive"
              className="min-h-12"
              disabled={remove.pending}
              onClick={() => {
                setErrors([]);
                setConflict([]);
                void remove.run(product);
              }}
            >
              {remove.pending ? (
                <>
                  <LoaderCircle className="animate-spin" aria-hidden />
                  Eliminando…
                </>
              ) : (
                'Sí, eliminar'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-12"
              disabled={remove.pending}
              onClick={() => setConfirming(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="min-h-12 justify-self-start"
          onClick={() => setConfirming(true)}
        >
          <Trash2 aria-hidden />
          Eliminar producto
        </Button>
      )}
    </section>
  );
}
