'use client';

import { PasswordForm } from '@/components/profile/password-form';
import { useSession } from '@/components/providers/session-provider';
import { ROLE_LABEL } from '@/lib/auth/nav';

const CARD = 'grid gap-4 rounded-xl border bg-card p-4 shadow-sm sm:p-6';
const TITLE = 'text-lg font-semibold';

/** «Mi cuenta» del personal (DP-11): su usuario, su rol y el cambio de contraseña. */
export function AccountView() {
  const { user } = useSession();
  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <header className="grid gap-1">
        <h1 className="text-2xl font-semibold">Mi cuenta</h1>
        <p className="text-muted-foreground">
          Si el administrador te dio una clave inicial, cámbiala por una tuya.
        </p>
      </header>
      <section aria-labelledby="cuenta-datos" className={CARD}>
        <h2 id="cuenta-datos" className={TITLE}>
          Mis datos
        </h2>
        <dl className="grid gap-3 text-sm">
          <div className="grid gap-0.5">
            <dt className="text-muted-foreground">Usuario</dt>
            <dd className="text-base font-medium break-all">{user.username}</dd>
          </div>
          <div className="grid gap-0.5">
            <dt className="text-muted-foreground">Rol</dt>
            <dd className="text-base font-medium">{ROLE_LABEL[user.role]}</dd>
          </div>
        </dl>
      </section>
      <section aria-labelledby="cuenta-clave" className={CARD}>
        <h2 id="cuenta-clave" className={TITLE}>
          Cambiar contraseña
        </h2>
        <PasswordForm />
      </section>
    </div>
  );
}
