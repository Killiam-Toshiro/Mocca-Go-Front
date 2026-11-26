'use client';

import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { formatJoined } from '@/lib/users/format';
import type { User } from '@/lib/users/types';
import { RoleBadge } from './role-badge';

/** Una fila por usuario: tarjeta en celular y filas en columnas desde `md`. */
export function UserList({
  users,
  selfId,
  onEdit,
}: {
  users: User[];
  selfId: string;
  onEdit: (user: User) => void;
}) {
  return (
    <ul aria-label="Usuarios" className="grid gap-3">
      {users.map((user) => {
        const own = user.id === selfId;
        const customer = user.role === 'cliente';
        return (
          <li
            key={user.id}
            className="grid gap-2 rounded-xl border bg-card p-4 shadow-sm md:grid-cols-[minmax(0,2fr)_auto_minmax(0,1.2fr)_auto] md:items-center md:gap-4"
          >
            <div className="min-w-0">
              <h3 className="font-semibold break-words">
                {customer ? (user.email ?? user.username) : user.username}
                {own ? (
                  <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                    Tú
                  </span>
                ) : null}
              </h3>
              <p className="text-sm break-words text-muted-foreground">
                {user.fullName ?? 'Sin nombre registrado'}
              </p>
              <p className="text-sm text-muted-foreground">
                Alta: {formatJoined(user.createdAt)}
              </p>
            </div>
            <RoleBadge role={user.role} />
            <p className="text-sm text-muted-foreground">
              {user.phone ?? 'Sin teléfono'}
            </p>
            {own ? (
              <p className="text-sm text-muted-foreground md:max-w-48">
                No puedes modificar tu propio usuario desde aquí.
              </p>
            ) : (
              <Button
                type="button"
                variant="outline"
                className="min-h-12 justify-self-start md:justify-self-end"
                onClick={() => onEdit(user)}
                aria-label={`${customer ? 'Editar cliente' : 'Editar usuario'} ${
                  customer ? (user.email ?? user.username) : user.username
                }`}
              >
                <Pencil aria-hidden />
                Editar
              </Button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
