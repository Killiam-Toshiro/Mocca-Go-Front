'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { ReasonField } from '@/components/inventory/reason-field';

export const FAIL_REASON_MAX = 200;
const SUGGESTIONS = [
  'El cliente no estaba en el punto',
  'No contestó el teléfono',
  'Dirección incorrecta',
];

/** «No entregado»: motivo obligatorio de 1 a 200 caracteres (DP-07). */
export function FailForm({
  number,
  pending,
  onSubmit,
  onBack,
  serverError,
}: {
  number: number;
  pending: boolean;
  onSubmit: (reason: string) => void;
  onBack: () => void;
  serverError?: string;
}) {
  const [reason, setReason] = useState('');
  const [touched, setTouched] = useState(false);
  const trimmed = reason.trim();
  const error =
    touched && trimmed === ''
      ? 'Escribe el motivo por el que no se entregó.'
      : touched && trimmed.length > FAIL_REASON_MAX
        ? `El máximo es ${String(FAIL_REASON_MAX)} caracteres.`
        : (serverError ?? undefined);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    setTouched(true);
    if (trimmed === '' || trimmed.length > FAIL_REASON_MAX) return;
    onSubmit(trimmed);
  }

  return (
    <form
      onSubmit={submit}
      noValidate
      aria-label={`No entregado el pedido ${String(number)}`}
      className="grid gap-3 rounded-lg border p-3"
    >
      <ReasonField
        id={`fail-${String(number)}`}
        label={`Motivo de la no entrega del pedido ${String(number)}`}
        value={reason}
        onChange={setReason}
        error={error}
        suggestions={SUGGESTIONS}
        max={FAIL_REASON_MAX}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="submit"
          variant="destructive"
          className="min-h-12 text-base"
          disabled={pending}
          aria-label={`Confirmar no entrega del pedido ${String(number)}`}
        >
          {pending ? 'Enviando…' : 'Marcar no entregado'}
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
    </form>
  );
}
