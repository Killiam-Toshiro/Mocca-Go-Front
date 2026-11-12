'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ErrorAlert } from '@/components/auth/error-alert';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { CATEGORY_LABEL, SIMPLE_CATEGORIES } from '@/lib/catalog/categories';
import {
  changedFields,
  editSchema,
  editValuesOf,
  formatCostPercent,
  hasChanges,
  type EditValues,
} from '@/lib/catalog/schemas';
import type { Product } from '@/lib/catalog/types';
import { useUpdateProduct } from '@/lib/catalog/use-product-actions';
import { formatCOP } from '@/lib/menu/format';

/** Editar datos y precios (DP-06): solo se envía lo modificado; el SKU es de solo lectura. */
export function EditProductForm({
  product,
  onSaved,
  onMissing,
}: {
  product: Product;
  onSaved: (product: Product) => void;
  onMissing: (messages: string[]) => void;
}) {
  const combo = product.category === 'combo';
  const schema = useMemo(() => editSchema(product), [product]);
  const form = useForm<EditValues>({
    resolver: zodResolver(schema),
    defaultValues: editValuesOf(product),
  });
  const { errors } = form.formState;
  const watched = useWatch({ control: form.control });
  const body = changedFields(product, {
    ...editValuesOf(product),
    ...(watched as Partial<EditValues>),
  } as EditValues);
  const dirty = hasChanges(body);
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [retry, setRetry] = useState(false);

  const update = useUpdateProduct({
    onDone: (saved) => {
      setServerErrors([]);
      setRetry(false);
      onSaved(saved);
    },
    onFail: (error) => {
      if (error.kind === 'missing') return onMissing(error.messages);
      const f = error.fields;
      if (f.name) form.setError('name', { message: f.name });
      if (f.description)
        form.setError('description', { message: f.description });
      if (f.price) form.setError('price', { message: f.price });
      if (f.cost && !combo) form.setError('cost', { message: f.cost });
      setServerErrors([
        ...error.messages,
        ...(f.category ? [f.category] : []),
        ...(f.sku ? [f.sku] : []),
        ...(f.components ? [f.components] : []),
        ...(f.cost && combo ? [f.cost] : []),
      ]);
      if (error.kind === 'ambiguous') setRetry(true);
    },
  });

  return (
    <form
      noValidate
      method="post"
      aria-label="Editar producto"
      className="grid gap-4"
      onSubmit={form.handleSubmit(() => {
        setServerErrors([]);
        setRetry(false);
        void update.run({ product, body });
      })}
    >
      <ErrorAlert messages={serverErrors} />
      <p className="text-sm text-muted-foreground">
        SKU <span className="font-semibold text-foreground">{product.sku}</span>{' '}
        (no se puede cambiar)
      </p>
      <FormField id="edit-name" label="Nombre" error={errors.name?.message}>
        {(control) => (
          <Input
            {...control}
            {...form.register('name')}
            autoComplete="off"
            maxLength={120}
          />
        )}
      </FormField>
      <FormField
        id="edit-description"
        label="Descripción"
        hint="Déjala vacía para borrarla."
        error={errors.description?.message}
      >
        {(control) => (
          <Input
            {...control}
            {...form.register('description')}
            autoComplete="off"
            maxLength={500}
          />
        )}
      </FormField>
      {combo ? null : (
        <FormField id="edit-category" label="Categoría">
          {(control) => (
            <Select {...control} {...form.register('category')}>
              {SIMPLE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {CATEGORY_LABEL[c]}
                </option>
              ))}
            </Select>
          )}
        </FormField>
      )}
      <FormField
        id="edit-price"
        label="Precio"
        hint="Pesos enteros, sin puntos."
        error={errors.price?.message}
      >
        {(control) => (
          <Input
            {...control}
            {...form.register('price')}
            inputMode="numeric"
            autoComplete="off"
          />
        )}
      </FormField>
      {combo ? (
        <p className="text-sm text-muted-foreground">
          Costo calculado {formatCOP(product.cost)} ·{' '}
          {formatCostPercent(product.costPercent)}. Cambia con los componentes.
        </p>
      ) : (
        <FormField
          id="edit-cost"
          label="Costo"
          hint={`Margen actual: ${formatCostPercent(product.costPercent)}.`}
          error={errors.cost?.message}
        >
          {(control) => (
            <Input
              {...control}
              {...form.register('cost')}
              inputMode="numeric"
              autoComplete="off"
            />
          )}
        </FormField>
      )}
      <Button
        type="submit"
        className="min-h-12 justify-self-start"
        disabled={update.pending || !dirty}
      >
        {update.pending ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden />
            Guardando…
          </>
        ) : retry ? (
          'Reintentar'
        ) : (
          'Guardar cambios'
        )}
      </Button>
    </form>
  );
}
