'use client';

import { LoaderCircle, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ErrorAlert } from '@/components/auth/error-alert';
import { Button } from '@/components/ui/button';
import type { User } from '@/lib/users/types';
import { useDeleteUser } from '@/lib/users/use-delete-user';
import { ServerNotice } from './server-notice';

/** Eliminar personal (DP-06): confirmación en línea y los 409/404 con el texto del back. */
export function DeleteUserSection({
  user,
  onDeleted,
  onMissing,
}: {
  user: User;
  onDeleted: () => void;
  onMissing: (messages: string[]) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [conflict, setConflict] = useState<string[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const remove = useDeleteUser({
    onDone: () => onDeleted(),
    onFail: (error) => {
      setConfirming(false);
      if (error.kind === 'missing') return onMissing(error.messages);
      if (error.kind === 'conflict') {
        const history = error.messages.some((m) => /historial/i.test(m));
        return setConflict(
          history
            ? [...error.messages, 'Ya tiene actividad; no se puede quitar.']
            : error.messages,
        );
      }
      setErrors(error.messages);
    },
  });

  return (
    <section aria-label="Eliminar usuario" className="grid gap-3">
      <h3 className="font-semibold">Eliminar usuario</h3>
      <p className="text-sm text-muted-foreground">
        Solo se puede eliminar a quien no tenga historial.
      </p>
      <ErrorAlert messages={errors} />
      <ServerNotice messages={conflict} onDismiss={() => setConflict([])} />
      {confirming ? (
        <div
          role="group"
          aria-label="Confirmar eliminación"
          className="grid gap-3 rounded-lg border border-destructive/50 p-4"
        >
          <p className="text-sm font-medium">
            ¿Eliminar a {user.username}? No se puede deshacer.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button
              type="button"
              variant="destructive"
              className="min-h-12"
              disabled={remove.pending}
              onClick={() => {
                setErrors([]);
                setConflict([]);
                void remove.run(user);
              }}
            >
              {remove.pending ? (
                <>
                  <LoaderCircle className="animate-spin" aria-hidden />
                  Eliminando…
                </>
              ) : (
                'Sí, eliminar'
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="min-h-12"
              disabled={remove.pending}
              onClick={() => setConfirming(false)}
            >
              Cancelar
            </Button>
          </div>
        </div>
      ) : (
        <Button
          type="button"
          variant="outline"
          className="min-h-12 justify-self-start"
          onClick={() => setConfirming(true)}
        >
          <Trash2 aria-hidden />
          Eliminar usuario
        </Button>
      )}
    </section>
  );
}
