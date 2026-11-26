'use client';

import { DialogPanel } from '@/components/ui/dialog-panel';
import type { User } from '@/lib/users/types';
import { ChangeRoleForm } from './change-role-form';
import { CreateUserForm } from './create-user-form';
import { DeleteUserSection } from './delete-user-section';
import { EditUserForm } from './edit-user-form';
import { ResetPasswordForm } from './reset-password-form';

export type PanelState = { kind: 'create' } | { kind: 'user'; user: User };

/** Panel lateral de crear o editar (DP-03 a DP-06). Cada apertura empieza de cero. */
export function UserPanel({
  panel,
  onClose,
  onCreated,
  onSaved,
  onRoleChanged,
  onDeleted,
  onMissing,
}: {
  panel: PanelState | null;
  onClose: () => void;
  onCreated: (user: User) => void;
  onSaved: (user: User) => void;
  onRoleChanged: (user: User) => void;
  onDeleted: (user: User) => void;
  onMissing: (messages: string[]) => void;
}) {
  const title =
    panel?.kind === 'create'
      ? 'Crear usuario'
      : panel
        ? `Usuario ${panel.user.email ?? panel.user.username}`
        : '';
  return (
    <DialogPanel open={panel !== null} onClose={onClose} title={title}>
      {panel?.kind === 'create' ? (
        <div className="p-4">
          <CreateUserForm onCreated={onCreated} />
        </div>
      ) : null}
      {panel?.kind === 'user' ? (
        <div key={panel.user.id} className="grid gap-8 p-4">
          <EditUserForm
            user={panel.user}
            onSaved={onSaved}
            onMissing={onMissing}
          />
          <ResetPasswordForm user={panel.user} onMissing={onMissing} />
          {panel.user.role !== 'cliente' ? (
            <>
              <ChangeRoleForm
                user={panel.user}
                onChanged={onRoleChanged}
                onMissing={onMissing}
              />
              <DeleteUserSection
                user={panel.user}
                onDeleted={() => onDeleted(panel.user)}
                onMissing={onMissing}
              />
            </>
          ) : null}
        </div>
      ) : null}
    </DialogPanel>
  );
}
