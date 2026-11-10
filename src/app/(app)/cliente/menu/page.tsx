import type { Metadata } from 'next';
import { MenuView } from '@/components/menu/menu-view';

export const metadata: Metadata = { title: 'Menú' };

export default function Page() {
  return <MenuView audience="cliente" />;
}
