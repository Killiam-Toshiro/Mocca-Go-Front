import type { Metadata } from 'next';
import { Suspense } from 'react';
import { SurveysView } from '@/components/surveys-admin/surveys-view';

export const metadata: Metadata = { title: 'Encuestas' };

export default function Page() {
  return (
    <Suspense>
      <SurveysView />
    </Suspense>
  );
}
