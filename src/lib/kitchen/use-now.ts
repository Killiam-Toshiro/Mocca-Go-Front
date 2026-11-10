'use client';

import { useSyncExternalStore } from 'react';
import { CLOCK_MS } from './board';

let current = 0;
const tick = () => {
  current = Date.now();
};

function subscribe(onChange: () => void): () => void {
  tick();
  const refresh = () => {
    tick();
    onChange();
  };
  const timer = setInterval(refresh, CLOCK_MS);
  // Una pestaña en segundo plano no refresca el reloj: al volver se recalcula.
  const onVisible = () => {
    if (document.visibilityState === 'visible') refresh();
  };
  document.addEventListener('visibilitychange', onVisible);
  return () => {
    clearInterval(timer);
    document.removeEventListener('visibilitychange', onVisible);
  };
}

function getSnapshot(): number {
  if (current === 0) tick();
  return current;
}

/** La hora actual (ms), refrescada cada 30 s para los «hace X min». */
export function useNow(): number {
  return useSyncExternalStore(subscribe, getSnapshot, () => 0);
}
