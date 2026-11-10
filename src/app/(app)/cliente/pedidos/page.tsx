import type { Metadata } from 'next';
import { OrdersView } from '@/components/orders/orders-view';

export const metadata: Metadata = { title: 'Mis pedidos' };

export default function Page() {
  return <OrdersView />;
}
