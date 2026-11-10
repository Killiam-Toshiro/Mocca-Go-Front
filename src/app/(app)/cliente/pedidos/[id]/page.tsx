import type { Metadata } from 'next';
import { OrderDetailView } from '@/components/orders/order-detail-view';

export const metadata: Metadata = { title: 'Pedido' };

export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nuevo?: string }>;
}) {
  const [{ id }, { nuevo }] = await Promise.all([params, searchParams]);
  return <OrderDetailView id={id} isNew={nuevo === '1'} />;
}
