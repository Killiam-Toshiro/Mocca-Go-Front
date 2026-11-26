'use client';

import { useSyncExternalStore } from 'react';

const subscribe = () => () => undefined;

/** `false` en el servidor y durante la hidratación; `true` ya en el navegador. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
