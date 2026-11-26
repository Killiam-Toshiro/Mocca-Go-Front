'use client';

import { lazy, Suspense, type ComponentProps, type ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

const Sales = lazy(() =>
  import('./charts').then((m) => ({ default: m.SalesChart })),
);
const Rating = lazy(() =>
  import('./charts').then((m) => ({ default: m.RatingChart })),
);
const Outcomes = lazy(() =>
  import('./charts').then((m) => ({ default: m.OutcomesChart })),
);

function Frame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div role="img" aria-label={label} className="min-w-0">
      <Suspense fallback={<Skeleton className="h-52 w-full" />}>
        {children}
      </Suspense>
    </div>
  );
}

/** Cada gráfica es una imagen para lectores de pantalla; los mismos datos van en una tabla aparte. */
export function SalesChart(
  props: ComponentProps<typeof Sales> & { label: string },
) {
  const { label, ...rest } = props;
  return (
    <Frame label={label}>
      <Sales {...rest} />
    </Frame>
  );
}
export function RatingChart(
  props: ComponentProps<typeof Rating> & { label: string },
) {
  const { label, ...rest } = props;
  return (
    <Frame label={label}>
      <Rating {...rest} />
    </Frame>
  );
}
export function OutcomesChart(
  props: ComponentProps<typeof Outcomes> & { label: string },
) {
  const { label, ...rest } = props;
  return (
    <Frame label={label}>
      <Outcomes {...rest} />
    </Frame>
  );
}
