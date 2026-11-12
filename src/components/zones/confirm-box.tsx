'use client';

import { LoaderCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Confirmación en línea (D-117, D-125): texto, avisos y los botones «Sí…» / «Cancelar». */
export function ConfirmBox({
  label,
  text,
  warnings = [],
  confirmLabel,
  busyLabel,
  destructive = false,
  pending,
  onConfirm,
  onCancel,
}: {
  label: string;
  text: string;
  warnings?: string[];
  confirmLabel: string;
  busyLabel: string;
  destructive?: boolean;
  pending: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid gap-3 rounded-lg border p-4"
    >
      <p className="text-sm font-medium">{text}</p>
      {warnings.map((w) => (
        <p key={w} role="status" className="text-sm text-destructive">
          {w}
        </p>
      ))}
      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          variant={destructive ? 'destructive' : 'default'}
          className="min-h-12"
          disabled={pending}
          onClick={onConfirm}
        >
          {pending ? (
            <>
              <LoaderCircle className="animate-spin" aria-hidden />
              {busyLabel}
            </>
          ) : (
            confirmLabel
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          className="min-h-12"
          disabled={pending}
          onClick={onCancel}
        >
          Cancelar
        </Button>
      </div>
    </div>
  );
}
