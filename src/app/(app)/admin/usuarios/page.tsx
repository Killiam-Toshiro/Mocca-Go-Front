import type { Metadata } from 'next';
import { UsersView } from '@/components/users/users-view';

export const metadata: Metadata = { title: 'Usuarios' };

export default function Page() {
  return <UsersView />;
}
