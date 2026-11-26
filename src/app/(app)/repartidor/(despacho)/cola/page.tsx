import type { Metadata } from 'next';
import { QueueView } from '@/components/dispatch/queue-view';

export const metadata: Metadata = { title: 'Cola de despacho' };

export default function Page() {
  return <QueueView />;
}
