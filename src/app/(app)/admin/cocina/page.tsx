import type { Metadata } from 'next';
import { KitchenScreen } from '@/components/kitchen/kitchen-screen';

export const metadata: Metadata = { title: 'Cocina' };

export default function Page() {
  return <KitchenScreen />;
}
