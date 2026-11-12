'use client';

import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { ErrorAlert } from '@/components/auth/error-alert';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  COMPONENTS_MESSAGE,
  comboTotals,
  MAX_COMPONENTS,
  MIN_COMPONENTS,
  type ComponentPick,
} from '@/lib/catalog/schemas';
import type { Product } from '@/lib/catalog/types';
import { useComponentOptions } from '@/lib/catalog/use-catalog';
import { useReplaceComponents } from '@/lib/catalog/use-product-actions';
import { formatCOP } from '@/lib/menu/format';
import { ComboBuilder } from './combo-builder';

function Editor({
  product,
  initial,
  unknown,
  onSaved,
  onMissing,
}: {
  product: Product;
  initial: ComponentPick[];
  unknown: number;
  onSaved: (product: Product) => void;
  onMissing: (messages: string[]) => void;
}) {
  const [picks, setPicks] = useState(initial);
  const [fieldError, setFieldError] = useState<string>();
  const [serverErrors, setServerErrors] = useState<string[]>([]);
  const [retry, setRetry] = useState(false);
  const save = useReplaceComponents({
    onDone: (saved) => {
      setServerErrors([]);
      setRetry(false);
      onSaved(saved);
    },
    onFail: (error) => {
      if (error.kind === 'missing') return onMissing(error.messages);
      setFieldError(error.fields.components);
      setServerErrors(error.messages);
      if (error.kind === 'ambiguous') setRetry(true);
    },
  });
  const totals = comboTotals(picks);
  const valid =
    picks.length >= MIN_COMPONENTS && picks.length <= MAX_COMPONENTS;
  const same =
    picks.length === initial.length &&
    picks.every((p) =>
      initial.some(
        (i) => i.productId === p.productId && i.quantity === p.quantity,
      ),
    );

  return (
    <form
      noValidate
      aria-label="Composición del combo"
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return setFieldError(COMPONENTS_MESSAGE);
        setFieldError(undefined);
        setServerErrors([]);
        setRetry(false);
        void save.run({
          product,
          components: picks.map((p) => ({
            productId: p.productId,
            quantity: p.quantity,
          })),
        });
      }}
    >
      <ErrorAlert messages={serverErrors} />
      <Alert className="text-sm">
        El precio del combo no cambia al cambiar sus componentes: revísalo.
        Precio actual {formatCOP(product.price)} · suma de componentes{' '}
        {formatCOP(totals.price)}.
      </Alert>
      <ComboBuilder
        value={picks}
        onChange={(next) => {
          setPicks(next);
          setFieldError(undefined);
        }}
        error={fieldError}
        note={
          unknown > 0
            ? `${String(unknown)} componente(s) inactivos no entran en la suma.`
            : undefined
        }
      />
      <Button
        type="submit"
        className="min-h-12 justify-self-start"
        disabled={save.pending || same}
      >
        {save.pending ? (
          <>
            <LoaderCircle className="animate-spin" aria-hidden />
            Guardando…
          </>
        ) : retry ? (
          'Reintentar'
        ) : (
          'Guardar composición'
        )}
      </Button>
    </form>
  );
}

/** Recomponer un combo (`PUT` completo, DP-06). Parte de la composición actual, con precios al día. */
export function CompositionForm({
  product,
  onSaved,
  onMissing,
}: {
  product: Product;
  onSaved: (product: Product) => void;
  onMissing: (messages: string[]) => void;
}) {
  const lookup = useComponentOptions('', true);
  if (lookup.isPending)
    return (
      <p role="status" className="text-sm text-muted-foreground">
        Cargando la composición…
      </p>
    );
  const byId = new Map((lookup.data ?? []).map((p) => [p.id, p]));
  const initial: ComponentPick[] = product.components.map((c) => ({
    productId: c.productId,
    sku: c.sku,
    name: c.name,
    quantity: c.quantity,
    price: byId.get(c.productId)?.price ?? 0,
    cost: byId.get(c.productId)?.cost ?? 0,
  }));
  const unknown = product.components.filter(
    (c) => !byId.has(c.productId),
  ).length;
  return (
    <Editor
      key={product.updatedAt}
      product={product}
      initial={initial}
      unknown={unknown}
      onSaved={onSaved}
      onMissing={onMissing}
    />
  );
}
