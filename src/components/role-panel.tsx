'use client';

import { useSession } from '@/components/providers/session-provider';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { NAV, ROLE_LABEL } from '@/lib/auth/nav';

/** Panel de bienvenida de cada rol. Las secciones futuras aparecen deshabilitadas. */
export function RolePanel() {
  const { user } = useSession();
  const upcoming = NAV[user.role].filter((item) => !item.enabled);

  return (
    <div className="mx-auto grid max-w-3xl gap-6">
      <div className="grid gap-1">
        <h1 className="text-2xl font-semibold tracking-tight">
          Hola, {user.username}
        </h1>
        <p className="text-sm text-muted-foreground">
          Ingresaste como{' '}
          <strong className="font-medium text-foreground">
            {ROLE_LABEL[user.role]}
          </strong>
          . Estamos construyendo tu panel.
        </p>
      </div>
      <section aria-labelledby="proximamente" className="grid gap-3">
        <h2
          id="proximamente"
          className="text-sm font-medium text-muted-foreground"
        >
          Próximamente
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2">
          {upcoming.map((item) => (
            <li key={item.href}>
              <Card aria-disabled="true" className="gap-0 py-4 opacity-60">
                <CardHeader>
                  <CardTitle className="text-base">{item.label}</CardTitle>
                  <CardDescription>
                    Disponible en una próxima versión.
                  </CardDescription>
                </CardHeader>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
