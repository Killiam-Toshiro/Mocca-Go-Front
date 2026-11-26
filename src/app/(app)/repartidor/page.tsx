import type { Metadata } from 'next';
import { RolePanel } from '@/components/role-panel';

export const metadata: Metadata = { title: 'Mi panel' };

export default function Page() {
  return <RolePanel />;
}
