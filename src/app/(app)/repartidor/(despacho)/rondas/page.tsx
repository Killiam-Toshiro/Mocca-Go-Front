import type { Metadata } from 'next';
import { RoundsView } from '@/components/dispatch/rounds-view';

export const metadata: Metadata = { title: 'Mis rondas' };

export default function Page() {
  return <RoundsView />;
}
