import type { Metadata } from 'next';
import { CatalogView } from '@/components/catalog/catalog-view';

export const metadata: Metadata = { title: 'Catálogo' };

export default function Page() {
  return <CatalogView />;
}
