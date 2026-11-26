import { act, screen } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LiveBadge } from '@/components/orders/live-badge';
import { setUnauthorizedHandler } from '@/lib/api/browser-client';
import type { openSseChannel, SseOptions } from '@/lib/sse/client';
import { renderWithQuery } from '../../../tests/utils/render';
import { HIDDEN_CLOSE_MS, OrdersLiveProvider } from './live';

function fakeOpen() {
  const calls: { options: SseOptions; close: ReturnType<typeof vi.fn> }[] = [];
  const open = vi.fn((options: SseOptions) => {
    const close = vi.fn();
    calls.push({ options, close });
    return { close };
  });
  return { open: open as unknown as typeof openSseChannel, calls };
}

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
afterEach(() => {
  vi.useRealTimers();
  setUnauthorizedHandler(null);
});

function mount(open: typeof openSseChannel, strict = false) {
  const ui = (
    <OrdersLiveProvider open={open}>
      <LiveBadge />
    </OrdersLiveProvider>
  );
  return renderWithQuery(strict ? <StrictMode>{ui}</StrictMode> : ui);
}
const region = () => document.querySelector('[aria-live="polite"]');
const order = (over: Record<string, unknown> = {}) => ({
  id: 'o1',
  number: 1001,
  status: 'recibido',
  ...over,
});

describe('OrdersLiveProvider', () => {
  it('abre un solo canal a /api/orders/stream y lo cierra al desmontar', () => {
    const { open, calls } = fakeOpen();
    const { unmount, rerender } = mount(open);
    expect(calls).toHaveLength(1);
    expect(calls[0]?.options.url).toBe('/api/orders/stream');
    rerender(
      <OrdersLiveProvider open={open}>
        <LiveBadge />
      </OrdersLiveProvider>,
    );
    expect(calls).toHaveLength(1);
    unmount();
    expect(calls[0]?.close).toHaveBeenCalledTimes(1);
  });

  it('con el doble montaje de React no queda más de un canal abierto', () => {
    const { open, calls } = fakeOpen();
    mount(open, true);
    const abiertos = calls.filter((c) => c.close.mock.calls.length === 0);
    expect(abiertos).toHaveLength(1);
  });

  it('muestra el estado del canal con texto', () => {
    const { open, calls } = fakeOpen();
    mount(open);
    expect(screen.queryByText(/en vivo/i)).toBeNull();
    const state = calls[0]!.options.onState!;
    act(() => state('connecting'));
    expect(screen.getByText('Conectando…')).toBeInTheDocument();
    act(() => state('live'));
    expect(screen.getByText('En vivo')).toBeInTheDocument();
    act(() => state('reconnecting'));
    expect(screen.getByText('Reconectando…')).toBeInTheDocument();
    act(() => state('stopped'));
    expect(screen.getByText('Se actualiza cada 15 s')).toBeInTheDocument();
  });

  it('`ready` y `order` vuelven a consultar los pedidos; lo demás se ignora', () => {
    const { open, calls } = fakeOpen();
    const { client } = mount(open);
    const spy = vi.spyOn(client, 'invalidateQueries');
    const onMessage = calls[0]!.options.onMessage;

    onMessage({ event: 'ready', data: '{}' });
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy.mock.calls.map((c) => c[0]?.queryKey)).toEqual([
      ['orders'],
      ['order'],
    ]);

    spy.mockClear();
    onMessage({ event: 'otra-cosa', data: 'x' });
    expect(spy).not.toHaveBeenCalled();

    // El contenido no importa: basura, JSON roto o HTML solo provocan una consulta.
    expect(() =>
      onMessage({ event: 'order', data: '<img src=x onerror=alert(1)>' }),
    ).not.toThrow();
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('un 401 del canal usa el camino de sesión vencida', () => {
    const { open, calls } = fakeOpen();
    const expire = vi.fn();
    setUnauthorizedHandler(expire);
    mount(open);
    calls[0]!.options.onUnauthorized!();
    expect(expire).toHaveBeenCalledTimes(1);
  });

  it('oculta 45 s cierra el canal; al volver lo reabre', () => {
    vi.useFakeTimers();
    const { open, calls } = fakeOpen();
    mount(open);
    act(() => setVisibility('hidden'));
    act(() => void vi.advanceTimersByTime(HIDDEN_CLOSE_MS - 1));
    expect(calls[0]?.close).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(1));
    expect(calls[0]?.close).toHaveBeenCalledTimes(1);

    act(() => setVisibility('visible'));
    expect(calls).toHaveLength(2);
  });

  it('si vuelve antes de 45 s no se cierra ni se abre otro', () => {
    vi.useFakeTimers();
    const { open, calls } = fakeOpen();
    mount(open);
    act(() => setVisibility('hidden'));
    act(() => void vi.advanceTimersByTime(30_000));
    act(() => setVisibility('visible'));
    act(() => void vi.advanceTimersByTime(60_000));
    expect(calls).toHaveLength(1);
    expect(calls[0]?.close).not.toHaveBeenCalled();
  });

  it('una pestaña que carga oculta no abre canal hasta mostrarse', () => {
    visibility = 'hidden';
    const { open, calls } = fakeOpen();
    mount(open);
    expect(calls).toHaveLength(0);
    act(() => setVisibility('visible'));
    expect(calls).toHaveLength(1);
  });

  describe('anuncios', () => {
    it('anuncia el cambio de estado de un pedido ya conocido', () => {
      const { open } = fakeOpen();
      const { client } = mount(open);
      act(() => void client.setQueryData(['order', 'o1'], order()));
      expect(region()).toHaveTextContent('');

      act(
        () =>
          void client.setQueryData(
            ['order', 'o1'],
            order({ status: 'en_camino' }),
          ),
      );
      expect(region()).toHaveTextContent('Pedido #1001: En camino');
    });

    it('no anuncia si el estado no cambió', () => {
      const { open } = fakeOpen();
      const { client } = mount(open);
      act(() => void client.setQueryData(['order', 'o1'], order()));
      act(() => void client.setQueryData(['order', 'o1'], order()));
      expect(region()).toHaveTextContent('');
    });

    it('también detecta cambios en la lista de pedidos', () => {
      const { open } = fakeOpen();
      const { client } = mount(open);
      const page = (status: string) => ({
        pages: [
          { data: [order({ status }), order({ id: 'o2', number: 1002 })] },
        ],
        pageParams: [1],
      });
      act(() => void client.setQueryData(['orders'], page('recibido')));
      act(() => void client.setQueryData(['orders'], page('en_preparacion')));
      expect(region()).toHaveTextContent('Pedido #1001: En preparación');
    });

    it('ignora datos con otra forma sin romperse', () => {
      const { open } = fakeOpen();
      const { client } = mount(open);
      expect(() =>
        act(() => {
          client.setQueryData(['order', 'x'], 'texto');
          client.setQueryData(['orders'], { pages: [{ data: [null, 3] }] });
          client.setQueryData(['order', 'y'], { id: 1 });
        }),
      ).not.toThrow();
      expect(region()).toHaveTextContent('');
    });
  });
});
