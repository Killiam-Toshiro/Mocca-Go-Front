import type { Metadata } from 'next';
import { MenuView } from '@/components/menu/menu-view';

export const metadata: Metadata = { title: 'Menú' };

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ vacio?: string }>;
}) {
  const { vacio } = await searchParams;
  return <MenuView audience="cliente" emptyCartNotice={vacio === '1'} />;
}
