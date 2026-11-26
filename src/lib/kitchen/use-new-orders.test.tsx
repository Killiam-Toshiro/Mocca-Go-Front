import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { kitchenOrder, kitchenPage } from '../../../tests/utils/kitchen';
import { useNow } from './use-now';
import { useNewKitchenOrders, useTitleCount } from './use-new-orders';

let visibility: DocumentVisibilityState = 'visible';
function setVisibility(next: DocumentVisibilityState) {
  visibility = next;
  document.dispatchEvent(new Event('visibilitychange'));
}
beforeEach(() => {
  visibility = 'visible';
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => visibility,
  });
});
afterEach(() => vi.useRealTimers());

function setup() {
  const client = new QueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}
const a = kitchenOrder({ number: 1001 });
const b = kitchenOrder({ number: 1002 });
const c = kitchenOrder({ number: 1003 });

describe('useNewKitchenOrders', () => {
  it('la primera carga no avisa; un pedido nuevo sí', () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useNewKitchenOrders(), { wrapper });
    act(
      () => void client.setQueryData(['kitchen', 'recibido'], kitchenPage([a])),
    );
    expect(result.current.announcement).toBe('');

    act(
      () =>
        void client.setQueryData(['kitchen', 'recibido'], kitchenPage([a, b])),
    );
    expect(result.current.announcement).toBe('Nuevo pedido #1002');
    expect(result.current.unseen).toBe(0); // la pestaña está a la vista
  });

  it('varios pedidos nuevos juntos se anuncian en una frase', () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useNewKitchenOrders(), { wrapper });
    act(
      () => void client.setQueryData(['kitchen', 'recibido'], kitchenPage([])),
    );
    act(
      () =>
        void client.setQueryData(['kitchen', 'recibido'], kitchenPage([a, b])),
    );
    expect(result.current.announcement).toBe('Nuevos pedidos: #1001, #1002');
  });

  it('con la pestaña oculta suma al contador y se limpia al volver', () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useNewKitchenOrders(), { wrapper });
    act(
      () => void client.setQueryData(['kitchen', 'recibido'], kitchenPage([a])),
    );
    act(() => setVisibility('hidden'));
    act(
      () =>
        void client.setQueryData(['kitchen', 'recibido'], kitchenPage([a, b])),
    );
    act(
      () =>
        void client.setQueryData(
          ['kitchen', 'recibido'],
          kitchenPage([a, b, c]),
        ),
    );
    expect(result.current.unseen).toBe(2);
    act(() => setVisibility('visible'));
    expect(result.current.unseen).toBe(0);
  });

  it('un pedido que sale de la cola no cuenta como nuevo y las otras colas se ignoran', () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useNewKitchenOrders(), { wrapper });
    act(
      () =>
        void client.setQueryData(['kitchen', 'recibido'], kitchenPage([a, b])),
    );
    act(
      () => void client.setQueryData(['kitchen', 'recibido'], kitchenPage([b])),
    );
    act(() => void client.setQueryData(['kitchen', 'listo'], kitchenPage([c])));
    act(() => void client.setQueryData(['kitchen', 'recibido'], 'basura'));
    expect(result.current.announcement).toBe('');
  });
});

describe('useTitleCount', () => {
  it('pone el contador en el título y lo restaura', () => {
    document.title = 'Cocina · Mocca Go';
    const { rerender, unmount } = renderHook(({ n }) => useTitleCount(n), {
      initialProps: { n: 0 },
    });
    expect(document.title).toBe('Cocina · Mocca Go');
    rerender({ n: 3 });
    expect(document.title).toBe('(3) Cocina · Mocca Go');
    rerender({ n: 0 });
    expect(document.title).toBe('Cocina · Mocca Go');
    rerender({ n: 2 });
    unmount();
    expect(document.title).toBe('Cocina · Mocca Go');
  });
});

describe('useNow', () => {
  it('avanza cada 30 s', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-10T18:00:00.000Z'));
    const { result } = renderHook(() => useNow());
    const first = result.current;
    act(() => void vi.advanceTimersByTime(29_999));
    expect(result.current).toBe(first);
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current - first).toBe(30_000);
  });
});
