'use client';

import { DialogPanel } from '@/components/ui/dialog-panel';
import type { Product } from '@/lib/catalog/types';
import { CompositionForm } from './composition-form';
import { CreateProductForm } from './create-product-form';
import { DeleteProductSection } from './delete-product-section';
import { EditProductForm } from './edit-product-form';

export type PanelState =
  { kind: 'create' } | { kind: 'product'; product: Product };

/** Panel lateral de crear o editar (DP-04, DP-06). Cada apertura empieza de cero. */
export function ProductPanel({
  panel,
  onClose,
  onCreated,
  onSaved,
  onDeleted,
  onStatusChanged,
  onMissing,
}: {
  panel: PanelState | null;
  onClose: () => void;
  onCreated: (product: Product) => void;
  onSaved: (product: Product) => void;
  onDeleted: (product: Product) => void;
  onStatusChanged: (product: Product) => void;
  onMissing: (messages: string[]) => void;
}) {
  const title =
    panel?.kind === 'create'
      ? 'Crear producto'
      : panel
        ? `Producto ${panel.product.name}`
        : '';
  return (
    <DialogPanel open={panel !== null} onClose={onClose} title={title}>
      {panel?.kind === 'create' ? (
        <div className="p-4">
          <CreateProductForm onCreated={onCreated} />
        </div>
      ) : null}
      {panel?.kind === 'product' ? (
        <div key={panel.product.id} className="grid gap-8 p-4">
          <EditProductForm
            key={panel.product.updatedAt}
            product={panel.product}
            onSaved={onSaved}
            onMissing={onMissing}
          />
          {panel.product.category === 'combo' ? (
            <CompositionForm
              product={panel.product}
              onSaved={onSaved}
              onMissing={onMissing}
            />
          ) : null}
          <DeleteProductSection
            product={panel.product}
            onDeleted={() => onDeleted(panel.product)}
            onStatusChanged={onStatusChanged}
            onMissing={onMissing}
          />
        </div>
      ) : null}
    </DialogPanel>
  );
}
