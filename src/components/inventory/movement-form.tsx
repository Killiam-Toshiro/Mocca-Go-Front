'use client';

import { useRef, useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { describeInventoryError } from '@/lib/inventory/errors';
import {
  REASON_SUGGESTIONS,
  SUBMIT_LABEL,
  TYPE_LABEL,
} from '@/lib/inventory/labels';
import {
  parseMovement,
  resultingStock,
  type MovementForm as Form,
} from '@/lib/inventory/movement';
import type { CreatedMovement, StaffProduct } from '@/lib/inventory/types';
import { useCreateMovement } from '@/lib/inventory/use-create-movement';
import { cn } from '@/lib/utils';
import { ReasonField } from './reason-field';

/**
 * Producción o salida de un producto, en línea bajo su fila. El movimiento no es idempotente: un solo
 * envío por vez, sin reintento automático, y ante un corte de red se pide revisar el historial (D-068).
 */
export function MovementForm({
  product,
  onCreated,
  onCancel,
  onStale,
  onViewHistory,
}: {
  product: Pick<StaffProduct, 'id' | 'name' | 'stock'>;
  onCreated: (created: CreatedMovement) => void;
  onCancel: () => void;
  /** El producto ya no existe. */
  onStale: (message: string) => void;
  onViewHistory: () => void;
}) {
  const [form, setForm] = useState<Form>({
    type: 'IN',
    quantity: '',
    reason: '',
  });
  const [tried, setTried] = useState(false);
  const create = useCreateMovement(onCreated, (error) => {
    const e = describeInventoryError(error, { writes: true });
    if (e.kind === 'missing') onStale(e.messages.join(' '));
  });
  const busy = useRef(false);

  const parsed = parseMovement(form, product.stock);
  const errors = tried && !parsed.ok ? parsed.errors : {};
  const described = create.isError
    ? describeInventoryError(create.error, { writes: true })
    : null;
  const failure = described && described.kind !== 'missing' ? described : null;
  const ambiguous = failure?.kind === 'ambiguous';
  const quantityNumber = /^[1-9][0-9]{0,8}$/.test(form.quantity.trim())
    ? Number(form.quantity.trim())
    : null;
  const preview =
    quantityNumber === null
      ? null
      : resultingStock(form.type, quantityNumber, product.stock);

  const id = `movement-${product.id}`;

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current || ambiguous) return;
    setTried(true);
    if (!parsed.ok) return;
    busy.current = true;
    create.mutate(
      { productId: product.id, ...parsed.value },
      {
        onSettled: () => {
          busy.current = false;
        },
      },
    );
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={`Registrar movimiento de ${product.name}`}
      className="grid gap-4 rounded-lg border bg-muted/40 p-4"
    >
      <fieldset className="grid gap-2">
        <legend className="text-sm font-medium">Tipo de movimiento</legend>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['IN', TYPE_LABEL.IN],
              ['OUT', TYPE_LABEL.OUT],
            ] as const
          ).map(([value, label]) => (
            <label
              key={value}
              className={cn(
                'flex min-h-12 cursor-pointer items-center justify-center rounded-lg border px-3 text-base font-semibold has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                form.type === value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-card text-card-foreground',
              )}
            >
              <input
                type="radio"
                name={`${id}-type`}
                value={value}
                checked={form.type === value}
                onChange={() => setForm({ ...form, type: value })}
                className="sr-only"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-1.5">
        <Label htmlFor={`${id}-quantity`}>Cantidad</Label>
        <Input
          id={`${id}-quantity`}
          inputMode="numeric"
          autoComplete="off"
          className="h-12 text-base"
          value={form.quantity}
          aria-invalid={errors.quantity ? true : undefined}
          aria-describedby={
            errors.quantity ? `${id}-quantity-error` : undefined
          }
          onChange={(e) => setForm({ ...form, quantity: e.target.value })}
        />
        {errors.quantity ? (
          <p id={`${id}-quantity-error`} className="text-sm text-destructive">
            {errors.quantity}
          </p>
        ) : null}
        <p className="text-sm text-muted-foreground">
          Disponibles ahora:{' '}
          <span className="tabular-nums">{product.stock}</span>
          {preview !== null && preview >= 0 ? (
            <>
              {' · '}Quedaría en:{' '}
              <span className="font-semibold tabular-nums">{preview}</span>
            </>
          ) : null}
        </p>
      </div>

      <ReasonField
        id={`${id}-reason`}
        value={form.reason}
        onChange={(reason) => setForm({ ...form, reason })}
        error={errors.reason}
        suggestions={REASON_SUGGESTIONS[form.type]}
      />

      {failure ? (
        <Alert variant="destructive" className="grid gap-2">
          <p>{failure.messages.join(' ')}</p>
          {ambiguous ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="justify-self-start"
              onClick={onViewHistory}
            >
              Ver historial
            </Button>
          ) : null}
        </Alert>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button type="submit" className="h-12 text-base" disabled={ambiguous}>
          {SUBMIT_LABEL[form.type]}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 text-base"
          onClick={onCancel}
        >
          Cancelar
        </Button>
      </div>
    </form>
  );
}
