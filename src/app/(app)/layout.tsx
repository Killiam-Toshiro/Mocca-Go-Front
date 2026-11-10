import { AppShell } from '@/components/app-shell';
import { BackendUnavailable } from '@/components/backend-unavailable';
import { SessionProvider } from '@/components/providers/session-provider';
import { requireAccess } from '@/lib/server/guards';

/** Todo lo que cuelga de aquí exige una sesión válida (cualquier rol) y comparte el marco. */
export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireAccess(null);
  if (access.status === 'unavailable') return <BackendUnavailable />;
  return (
    <SessionProvider user={access.user} expiresAt={access.expiresAt}>
      <AppShell>{children}</AppShell>
    </SessionProvider>
  );
}
