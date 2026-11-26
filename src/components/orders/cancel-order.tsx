'use client';

import { useState } from 'react';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { describeApiError, isApiError } from '@/lib/api/errors';
import { useCancelOrder } from '@/lib/orders/use-cancel-order';

/** Cancelar un pedido en «recibido», con confirmación en línea (D-044). */
export function CancelOrder({
  orderId,
  status,
}: {
  orderId: string;
  status: string;
}) {
  const cancel = useCancelOrder(orderId);
  const [confirming, setConfirming] = useState(false);
  const conflict = isApiError(cancel.error) && cancel.error.status === 409;

  // Tras un 409 el pedido ya cambió de estado: el aviso se queda aunque desaparezca el botón.
  if (status !== 'recibido' && !conflict) return null;

  return (
    <div className="grid gap-3">
      {cancel.isError ? (
        <Alert variant="destructive">
          {conflict
            ? 'Este pedido ya entró a preparación y no se puede cancelar.'
            : describeApiError(cancel.error).join(' ')}
        </Alert>
      ) : null}
      {confirming && !conflict ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm">
            ¿Cancelar el pedido? Se te devolverá el pago.
          </span>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={cancel.isPending}
            onClick={() => cancel.mutate()}
          >
            {cancel.isPending ? 'Cancelando…' : 'Sí, cancelar'}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={cancel.isPending}
            onClick={() => setConfirming(false)}
          >
            No
          </Button>
        </div>
      ) : conflict ? null : (
        <Button
          type="button"
          variant="outline"
          className="justify-self-start"
          onClick={() => setConfirming(true)}
        >
          Cancelar pedido
        </Button>
      )}
    </div>
  );
}
