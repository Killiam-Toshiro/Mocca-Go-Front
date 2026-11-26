import type { ReactNode } from 'react';
import { DispatchShell } from '@/components/dispatch/dispatch-shell';

export default function Layout({ children }: { children: ReactNode }) {
  return <DispatchShell>{children}</DispatchShell>;
}
