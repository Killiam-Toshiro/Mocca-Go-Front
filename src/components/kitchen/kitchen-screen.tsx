'use client';

import { KitchenView } from '@/components/kitchen/kitchen-view';
import { LiveChannelProvider } from '@/lib/live/channel';

const KITCHEN_KEYS = [['kitchen']] as const;

/** Pantalla de cocina: abre el canal en vivo solo mientras está a la vista (D-060). */
export function KitchenScreen() {
  return (
    <LiveChannelProvider url="/api/kitchen/stream" invalidate={KITCHEN_KEYS}>
      <KitchenView />
    </LiveChannelProvider>
  );
}
