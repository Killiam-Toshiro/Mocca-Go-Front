'use client';

import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

/** Aviso de 409/404 de una acción (D-058): el texto del back y «Entendido». */
export function CatalogNotice({
  messages,
  onDismiss,
}: {
  messages: string[];
  onDismiss: () => void;
}) {
  if (messages.length === 0) return null;
  return (
    <Alert variant="destructive" className="grid gap-3">
      {messages.map((m) => (
        <p key={m}>{m}</p>
      ))}
      <Button
        type="button"
        variant="outline"
        className="min-h-12 justify-self-start"
        onClick={onDismiss}
      >
        Entendido
      </Button>
    </Alert>
  );
}
