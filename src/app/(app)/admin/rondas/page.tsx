import type { Metadata } from 'next';
import { StaffRoundsView } from '@/components/staff-rounds/staff-rounds-view';

export const metadata: Metadata = { title: 'Rondas' };

export default function Page() {
  return <StaffRoundsView base="/admin" />;
}
