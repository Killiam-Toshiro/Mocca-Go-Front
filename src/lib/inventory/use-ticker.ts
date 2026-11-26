'use client';

import { useSyncExternalStore } from 'react';

interface Ticker {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => number;
}

const tickers = new Map<number, Ticker>();

function createTicker(ms: number): Ticker {
  let current = 0;
  const tick = () => {
    current = Date.now();
  };
  return {
    subscribe(onChange) {
      tick();
      const refresh = () => {
        tick();
        onChange();
      };
      const timer = setInterval(refresh, ms);
      // Una pestaña en segundo plano no refresca el reloj: al volver se recalcula.
      const onVisible = () => {
        if (document.visibilityState === 'visible') refresh();
      };
      document.addEventListener('visibilitychange', onVisible);
      return () => {
        clearInterval(timer);
        document.removeEventListener('visibilitychange', onVisible);
      };
    },
    getSnapshot() {
      if (current === 0) tick();
      return current;
    },
  };
}

/** La hora actual (ms), refrescada cada `ms` (para «Actualizado hace N s»). */
export function useTicker(ms: number): number {
  let ticker = tickers.get(ms);
  if (!ticker) {
    ticker = createTicker(ms);
    tickers.set(ms, ticker);
  }
  return useSyncExternalStore(ticker.subscribe, ticker.getSnapshot, () => 0);
}
