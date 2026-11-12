import type { Metadata } from 'next';
import { StaffOrdersScreen } from '@/components/staff-orders/staff-orders-screen';
import { StaffOrdersView } from '@/components/staff-orders/staff-orders-view';

export const metadata: Metadata = { title: 'Pedidos' };

export default function Page() {
  return (
    <StaffOrdersScreen>
      <StaffOrdersView base="/admin" />
    </StaffOrdersScreen>
  );
}
