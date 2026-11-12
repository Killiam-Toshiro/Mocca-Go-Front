import type { Metadata } from 'next';
import { StaffRoundDetail } from '@/components/staff-rounds/staff-round-detail';

export const metadata: Metadata = { title: 'Ronda' };

export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <StaffRoundDetail id={id} base="/operador" />;
}
