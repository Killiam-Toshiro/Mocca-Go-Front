import { BackendUnavailable } from '@/components/backend-unavailable';
import { requireAccess } from '@/lib/server/guards';

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireAccess('repartidor');
  if (access.status === 'unavailable') return <BackendUnavailable />;
  return children;
}
