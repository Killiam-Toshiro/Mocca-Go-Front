'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import { ErrorAlert } from '@/components/auth/error-alert';
import { FormField } from '@/components/form-field';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { CATEGORY_LABEL, SIMPLE_CATEGORIES } from '@/lib/catalog/categories';
import {
  comboTotals,
  createBody,
  productSchema,
  type ProductFormValues,
} from '@/lib/catalog/schemas';
import type { Product } from '@/lib/catalog/types';
import { useCreateProduct } from '@/lib/catalog/use-product-actions';
import { formatCOP } from '@/lib/menu/format';
import { ComboBuilder } from './combo-builder';

const DEFAULTS: ProductFormValues = {
  kind: 'producto',
  sku: '',
  name: '',
  description: '',
  category: 'cafe',
  price: '',
  cost: '',
  components: [],
};

/** Crear un producto simple o un combo (DP-04). El SKU se escribe en mayúsculas. */
export function CreateProductForm({
  onCreated,
}: {
  onCreated: (product: Product) => void;
}) {
  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: DEFAULTS,
  });
  const { errors } = form.formState;
  const kind = useWatch({ control: form.control, name: 'kind' });
  const components = useWatch({ control: form.control, name: 'components' });
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [retry, setRetry] = useState(false);
  const combo = kind === 'combo';

  const create = useCreateProduct({
    onDone: (product) => onCreated(product),
    onFail: (error) => {
      const f = error.fields;
      if (f.sku) form.setError('sku', { message: f.sku });
      if (f.name) form.setError('name', { message: f.name });
      if (f.description)
        form.setError('description', { message: f.description });
      if (f.price) form.setError('price', { message: f.price });
      if (f.cost && !combo) form.setError('cost', { message: f.cost });
      if (f.components) form.setError('components', { message: f.components });
      setServerErrors([
        ...error.messages,
        ...(f.category ? [f.category] : []),
        ...(f.cost && combo ? [f.cost] : []),
      ]);
      if (error.kind === 'ambiguous') setRetry(true);
    },
  });

  return (
    <form
      noValidate
      method="post"
      aria-label="Crear producto"
      className="grid gap-4"
      onSubmit={form.handleSubmit((values) => {
        setServerErrors([]);
        setRetry(false);
        void create.run(createBody(values));
      })}
    >
      <ErrorAlert messages={serverErrors} />
      <FormField id="new-kind" label="Tipo">
        {(control) => (
          <Select {...control} {...form.register('kind')}>
            <option value="producto">Producto</option>
            <option value="combo">Combo</option>
          </Select>
        )}
      </FormField>
      <FormField
        id="new-sku"
        label="SKU"
        hint="Código único e inmutable: mayúsculas, números, punto, guion o guion bajo."
        error={errors.sku?.message}
      >
        {(control) => (
          <Input
            {...control}
            {...form.register('sku', {
              onChange: (e: { target: HTMLInputElement }) => {
                e.target.value = e.target.value.toUpperCase();
              },
            })}
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={48}
          />
        )}
      </FormField>
      <FormField id="new-name" label="Nombre" error={errors.name?.message}>
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
        id="new-description"
        label="Descripción (opcional)"
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
        <FormField
          id="new-category"
          label="Categoría"
          error={errors.category?.message}
        >
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
        id="new-price"
        label={combo ? 'Precio (opcional)' : 'Precio'}
        hint={
          combo
            ? `Si lo dejas vacío, vale la suma de los componentes (${formatCOP(comboTotals(components).price)}).`
            : 'Pesos enteros, sin puntos: 4500.'
        }
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
        <ComboBuilder
          value={components}
          onChange={(next) =>
            form.setValue('components', next, {
              shouldValidate: form.formState.isSubmitted,
            })
          }
          error={errors.components?.message}
        />
      ) : (
        <FormField
          id="new-cost"
          label="Costo"
          hint="Pesos enteros, sin puntos: 1600."
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
        disabled={create.pending}
      >
        {create.pending ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden />
            Creando…
          </>
        ) : retry ? (
          'Reintentar'
        ) : combo ? (
          'Crear combo'
        ) : (
          'Crear producto'
        )}
      </Button>
    </form>
  );
}
