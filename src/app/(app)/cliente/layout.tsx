import { BackendUnavailable } from '@/components/backend-unavailable';
import { OrdersLiveProvider } from '@/lib/orders/live';
import { requireAccess } from '@/lib/server/guards';

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await requireAccess('cliente');
  if (access.status === 'unavailable') return <BackendUnavailable />;
  return <OrdersLiveProvider>{children}</OrdersLiveProvider>;
}
