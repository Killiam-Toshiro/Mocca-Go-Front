'use client';

import { UserPlus } from 'lucide-react';
import { useState } from 'react';
import { useSession } from '@/components/providers/session-provider';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Pagination } from '@/components/ui/pagination';
import { Skeleton } from '@/components/ui/skeleton';
import { describeApiError } from '@/lib/api/errors';
import type { RoleFilter } from '@/lib/users/roles';
import { roleLabel } from '@/lib/users/roles';
import type { User } from '@/lib/users/types';
import { useDebouncedValue } from '@/lib/users/use-debounced-value';
import { USERS_PAGE_SIZE, useUsers } from '@/lib/users/use-users';
import { ServerNotice } from './server-notice';
import { UserList } from './user-list';
import { UserPanel, type PanelState } from './user-panel';
import { UsersFilters } from './users-filters';

const ROOT = 'mx-auto grid w-full max-w-5xl gap-6';

/** Pantalla «Usuarios» del admin (DP-01 a DP-08): lista paginada con búsqueda y filtro del servidor. */
export function UsersView() {
  const { user: me } = useSession();
  const [search, setSearch] = useState('');
  const [role, setRole] = useState<RoleFilter>('personal');
  const [pageState, setPageState] = useState({ page: 1, key: '' });
  const [panel, setPanel] = useState<PanelState | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[]>([]);

  const debounced = useDebouncedValue(search.trim());
  // Al cambiar la búsqueda o el rol se vuelve a la página 1 sin efectos.
  const key = `${debounced}|${role}`;
  const page = pageState.key === key ? pageState.page : 1;
  const query = useUsers({ page, search: debounced, role });
  const data = query.data;

  function announce(text: string) {
    setNotice(text);
    setPanel(null);
  }
  const name = (u: User) => u.email ?? u.username;

  return (
    <div className={ROOT}>
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="grid gap-1">
          <h1 className="text-2xl font-semibold">Usuarios</h1>
          <p className="text-muted-foreground">
            Crea al personal, edita sus datos y gestiona sus contraseñas y
            roles.
          </p>
        </div>
        <Button
          type="button"
          className="min-h-12"
          onClick={() => {
            setNotice(null);
            setPanel({ kind: 'create' });
          }}
        >
          <UserPlus aria-hidden />
          Crear usuario
        </Button>
      </header>

      <UsersFilters
        search={search}
        role={role}
        onSearch={setSearch}
        onRole={setRole}
      />

      <div role="status" className={notice ? 'grid' : 'sr-only'}>
        {notice ? (
          <p className="rounded-lg border bg-card px-4 py-3 text-sm font-medium">
            {notice}
          </p>
        ) : null}
      </div>
      <ServerNotice messages={missing} onDismiss={() => setMissing([])} />

      {query.isPending ? (
        <div
          role="status"
          aria-label="Cargando usuarios"
          className="grid gap-3"
        >
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : query.isError && !data ? (
        <Alert variant="destructive" className="grid gap-3">
          <p>{describeApiError(query.error).join(' ')}</p>
          <Button
            type="button"
            variant="outline"
            className="min-h-12 justify-self-start"
            onClick={() => void query.refetch()}
          >
            Reintentar
          </Button>
        </Alert>
      ) : data ? (
        <>
          <p
            role="status"
            className="text-sm text-muted-foreground"
            aria-live="polite"
          >
            {query.isPlaceholderData
              ? 'Buscando…'
              : data.total === 1
                ? '1 resultado'
                : `${data.total} resultados`}
          </p>
          {data.data.length === 0 ? (
            <p className="rounded-xl border bg-card p-6 text-center text-muted-foreground">
              No hay usuarios que coincidan con la búsqueda.
            </p>
          ) : (
            <UserList
              users={data.data}
              selfId={me.id}
              onEdit={(user) => {
                setNotice(null);
                setPanel({ kind: 'user', user });
              }}
            />
          )}
          <Pagination
            label="Páginas de usuarios"
            page={data.page}
            totalPages={data.totalPages}
            total={data.total}
            pageSize={data.limit || USERS_PAGE_SIZE}
            disabled={query.isPlaceholderData}
            onPageChange={(next) => setPageState({ page: next, key })}
          />
        </>
      ) : null}

      <UserPanel
        panel={panel}
        onClose={() => setPanel(null)}
        onCreated={(user) =>
          announce(
            `Usuario ${user.username} creado. Pídele que cambie la contraseña en «Mi cuenta».`,
          )
        }
        onSaved={(user) => setPanel({ kind: 'user', user })}
        onRoleChanged={(user) =>
          announce(
            `${name(user)} ahora es ${roleLabel(user.role).toLowerCase()}. Se cerró su sesión y deberá iniciar sesión de nuevo.`,
          )
        }
        onDeleted={(user) => announce(`Eliminamos a ${name(user)}.`)}
        onMissing={(messages) => {
          setPanel(null);
          setMissing([
            ...messages,
            'Actualizamos la lista para que veas el estado actual.',
          ]);
        }}
      />
    </div>
  );
}
