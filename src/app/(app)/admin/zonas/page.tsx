import type { Metadata } from 'next';
import { ZonesView } from '@/components/zones/zones-view';

export const metadata: Metadata = { title: 'Zonas y puntos' };

export default function Page() {
  return <ZonesView />;
}
