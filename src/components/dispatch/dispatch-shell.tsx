'use client';

import type { ReactNode } from 'react';
import { LiveChannelProvider } from '@/lib/live/channel';

const DISPATCH_KEYS = [['dispatch']] as const;

/**
 * Abre el canal en vivo de despacho una sola vez mientras el repartidor está en «Cola» o en
 * «Mis rondas»: pasar de una a otra no reabre la conexión (D-047, D-060).
 */
export function DispatchShell({ children }: { children: ReactNode }) {
  return (
    <LiveChannelProvider url="/api/dispatch/stream" invalidate={DISPATCH_KEYS}>
      {children}
    </LiveChannelProvider>
  );
}
