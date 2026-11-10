import 'server-only';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { decideAccess, decideAuthPageAccess } from '@/lib/auth/access';
import type { Role } from '@/lib/auth/roles';
import type { SessionUser } from '@/lib/auth/types';
import { getSession } from './session';

export type GuardResult =
  | { status: 'ok'; user: SessionUser; expiresAt: number | null }
  | { status: 'unavailable' };

/**
 * Guarda de un layout privado. `redirect()` corta el render; si el back no responde
 * se devuelve `unavailable` para mostrar un aviso en lugar de mandar a la persona a /login.
 * La ruta actual la fija `proxy.ts` en `x-next-path` (los layouts no la conocen).
 */
export async function requireAccess(
  required: Role | null,
): Promise<GuardResult> {
  const [session, headerList] = await Promise.all([getSession(), headers()]);
  const access = decideAccess(
    session,
    required,
    headerList.get('x-next-path') ?? '/',
  );
  if (access.action === 'redirect') redirect(access.to);
  if (access.action === 'unavailable') return { status: 'unavailable' };
  return { status: 'ok', user: access.user, expiresAt: access.expiresAt };
}

/** Guarda de `/login` y `/registro`: con sesión válida se va al home del rol. */
export async function redirectIfAuthenticated(): Promise<void> {
  const { redirectTo } = decideAuthPageAccess(await getSession());
  if (redirectTo) redirect(redirectTo);
}
