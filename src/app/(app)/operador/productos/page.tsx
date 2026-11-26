import type { Metadata } from 'next';
import { ProductsView } from '@/components/inventory/products-view';

export const metadata: Metadata = { title: 'Productos' };

export default function Page() {
  return <ProductsView />;
}
