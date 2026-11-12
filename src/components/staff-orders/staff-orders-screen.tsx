'use client';

import type { ReactNode } from 'react';
import { LiveChannelProvider } from '@/lib/live/channel';

const KEYS = [['staff-orders'], ['staff-order'], ['kitchen']] as const;

/** Abre el canal de cocina solo mientras la pantalla está a la vista; respaldo: sondeo de 15 s (D-122). */
export function StaffOrdersScreen({ children }: { children: ReactNode }) {
  return (
    <LiveChannelProvider url="/api/kitchen/stream" invalidate={KEYS}>
      {children}
    </LiveChannelProvider>
  );
}
