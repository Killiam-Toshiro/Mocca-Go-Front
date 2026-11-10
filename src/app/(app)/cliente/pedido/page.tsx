import type { Metadata } from 'next';
import { CheckoutView } from '@/components/orders/checkout-view';

export const metadata: Metadata = { title: 'Tu pedido' };

export default function Page() {
  return <CheckoutView />;
}
