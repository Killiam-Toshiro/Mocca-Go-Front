import { useSyncExternalStore } from 'react';

/** Simula `useSearchParams` y `router.replace` de Next: la «URL» vive aquí y avisa a quien la lee. */
let params = new URLSearchParams();
const subscribers = new Set<() => void>();

function set(query: string): void {
  params = new URLSearchParams(query);
  subscribers.forEach((notify) => notify());
}

export const urlMock = {
  /** Deja la URL como `?query` y borra el historial de `replace`. */
  reset(query = ''): void {
    params = new URLSearchParams(query);
    urlMock.replaced = [];
  },
  replaced: [] as string[],
  current: (): string => params.toString(),
};

export function useMockSearchParams(): URLSearchParams {
  return useSyncExternalStore(
    (notify) => {
      subscribers.add(notify);
      return () => subscribers.delete(notify);
    },
    () => params,
    () => params,
  );
}

export function useMockRouter() {
  return {
    replace(url: string): void {
      urlMock.replaced.push(url);
      const i = url.indexOf('?');
      set(i < 0 ? '' : url.slice(i + 1));
    },
  };
}
