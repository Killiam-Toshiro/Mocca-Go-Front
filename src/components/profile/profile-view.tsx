'use client';

import { PasswordForm } from '@/components/profile/password-form';
import { ProfileForm } from '@/components/profile/profile-form';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { describeApiError } from '@/lib/api/errors';
import { memberSince } from '@/lib/profile/format';
import { useProfile } from '@/lib/profile/use-profile';

const CARD = 'grid gap-4 rounded-xl border bg-card p-4';
const TITLE = 'font-display text-xl font-semibold';

/** «Mi perfil»: mis datos, editar nombre y celular, cambiar contraseña (DP-06). */
export function ProfileView() {
  const query = useProfile();
  const profile = query.data;

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-6">
      <h1 className="font-display text-3xl font-semibold">Mi perfil</h1>

      {query.isPending ? (
        <div
          aria-busy="true"
          aria-label="Cargando tu perfil"
          className="grid gap-4"
        >
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : query.isError || !profile ? (
        <Alert variant="destructive" className="grid gap-2">
          {describeApiError(query.error).map((line) => (
            <p key={line}>{line}</p>
          ))}
          <Button
            type="button"
            variant="outline"
            className="min-h-12 justify-self-start"
            onClick={() => void query.refetch()}
          >
            Reintentar
          </Button>
        </Alert>
      ) : (
        <>
          <section aria-labelledby="datos-titulo" className={CARD}>
            <h2 id="datos-titulo" className={TITLE}>
              Mis datos
            </h2>
            <dl className="grid gap-3 text-sm">
              <div className="grid gap-0.5">
                <dt className="text-muted-foreground">Correo</dt>
                <dd className="text-base font-medium break-all">
                  {profile.email}
                </dd>
                <dd className="text-muted-foreground">
                  El correo no se puede cambiar.
                </dd>
              </div>
              <div className="grid gap-0.5">
                <dt className="text-muted-foreground">Cliente desde</dt>
                <dd className="text-base font-medium">
                  {memberSince(profile.createdAt)}
                </dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="editar-titulo" className={CARD}>
            <h2 id="editar-titulo" className={TITLE}>
              Nombre y celular
            </h2>
            <ProfileForm profile={profile} />
          </section>

          <section aria-labelledby="clave-titulo" className={CARD}>
            <h2 id="clave-titulo" className={TITLE}>
              Cambiar contraseña
            </h2>
            <PasswordForm />
          </section>
        </>
      )}
    </div>
  );
}
