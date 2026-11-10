'use client';

import { useRef, useState } from 'react';
import { FormField } from '@/components/form-field';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { describeKitchenError } from '@/lib/kitchen/errors';
import { useKitchenCancel } from '@/lib/kitchen/use-kitchen-cancel';
import type { Order } from '@/lib/orders/types';

export const REASON_MAX = 200;

/** Cancelar desde cocina: motivo obligatorio y aviso de reembolso (D-059). */
export function CancelKitchenOrder({
  order,
  onDone,
  onStale,
}: {
  order: Pick<Order, 'id' | 'number'>;
  onDone?: (order: Order) => void;
  /** Si el pedido ya cambió, el aviso se muestra en la pantalla (la tarjeta se mueve de columna). */
  onStale?: (message: string) => void;
}) {
  const cancel = useKitchenCancel(onDone, (error) => {
    const e = describeKitchenError(error);
    if (onStale && (e.kind === 'conflict' || e.kind === 'missing'))
      onStale(e.messages.join(' '));
  });
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [missing, setMissing] = useState(false);
  const described = cancel.isError ? describeKitchenError(cancel.error) : null;
  const failure =
    described &&
    !(
      onStale &&
      (described.kind === 'conflict' || described.kind === 'missing')
    )
      ? described
      : null;
  const busy = useRef(false);

  if (!open) {
    return (
      <Button
        type="button"
        variant="outline"
        className="h-12 text-base"
        aria-label={`Cancelar el pedido ${String(order.number)}`}
        onClick={() => setOpen(true)}
      >
        Cancelar
      </Button>
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (busy.current) return;
    const trimmed = reason.trim();
    if (trimmed === '') {
      setMissing(true);
      return;
    }
    setMissing(false);
    busy.current = true;
    cancel.mutate(
      { id: order.id, reason: trimmed },
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
      className="grid gap-3 rounded-lg border p-3"
    >
      <FormField
        id={`reason-${order.id}`}
        label={`Motivo de la cancelación del pedido ${String(order.number)}`}
        error={missing ? 'Escribe el motivo de la cancelación.' : undefined}
        hint={`${String(reason.length)}/${String(REASON_MAX)} · Se reembolsará el pago al cliente.`}
      >
        {(control) => (
          <Input
            {...control}
            required
            autoFocus
            disabled={cancel.isPending}
            maxLength={REASON_MAX}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        )}
      </FormField>
      {failure ? (
        <Alert variant="destructive">{failure.messages.join(' ')}</Alert>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="destructive"
          className="h-12 text-base"
          disabled={cancel.isPending}
        >
          {cancel.isPending ? 'Cancelando…' : 'Confirmar cancelación'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-12 text-base"
          disabled={cancel.isPending}
          onClick={() => {
            setOpen(false);
            setMissing(false);
          }}
        >
          Volver
        </Button>
      </div>
    </form>
  );
}
