'use client';

import { Button } from '@/components/ui/button';

/** Confirmación en línea de «Entregado»: no se puede deshacer y dispara la encuesta del cliente (DP-07). */
export function DeliverConfirm({
  number,
  pending,
  onConfirm,
  onBack,
}: {
  number: number;
  pending: boolean;
  onConfirm: () => void;
  onBack: () => void;
}) {
  return (
    <div
      role="group"
      aria-label={`Confirmar entrega del pedido ${String(number)}`}
      className="grid gap-3 rounded-lg border p-3"
    >
      <p className="font-medium">¿Entregaste el pedido #{number}?</p>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="min-h-12 text-base"
          disabled={pending}
          autoFocus
          aria-label={`Sí, entregado el pedido ${String(number)}`}
          onClick={onConfirm}
        >
          {pending ? 'Enviando…' : 'Sí, entregado'}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-12 text-base"
          disabled={pending}
          onClick={onBack}
        >
          Volver
        </Button>
      </div>
    </div>
  );
}
