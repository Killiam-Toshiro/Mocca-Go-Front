'use client';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/** Aviso de 409/404 de una acción (D-058): el texto del back y «Entendido». */
export function ZonesNotice({
  messages,
  onDismiss,
  action,
}: {
  messages: string[];
  onDismiss: () => void;
  /** Alternativa opcional (p. ej. «Desactivar» tras un 409 por historial). */
  action?: { label: string; onClick: () => void };
}) {
  if (messages.length === 0) return null;
  return (
    <Alert variant="destructive" className="grid gap-3">
      {messages.map((m) => (
        <p key={m}>{m}</p>
      ))}
      <div className="flex flex-wrap gap-3">
        {action ? (
          <Button type="button" className="min-h-12" onClick={action.onClick}>
            {action.label}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="outline"
          className="min-h-12"
          onClick={onDismiss}
        >
          Entendido
        </Button>
      </div>
    </Alert>
  );
}
