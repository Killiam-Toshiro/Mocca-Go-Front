import type { Metadata } from 'next';
import { AccountView } from '@/components/account/account-view';

export const metadata: Metadata = { title: 'Mi cuenta' };

export default function Page() {
  return <AccountView />;
}
