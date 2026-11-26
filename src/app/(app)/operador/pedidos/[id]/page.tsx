import type { Metadata } from 'next';
import { StaffOrderDetail } from '@/components/staff-orders/staff-order-detail';
import { StaffOrdersScreen } from '@/components/staff-orders/staff-orders-screen';

export const metadata: Metadata = { title: 'Pedido' };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <StaffOrdersScreen>
      <StaffOrderDetail id={id} base="/operador" />
    </StaffOrdersScreen>
  );
}
