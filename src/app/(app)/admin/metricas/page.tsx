import type { Metadata } from 'next';
import { Suspense } from 'react';
import { MetricsView } from '@/components/metrics/metrics-view';

export const metadata: Metadata = { title: 'Métricas' };

export default function Page() {
  return (
    <Suspense>
      <MetricsView />
    </Suspense>
  );
}
