import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../../tests/utils/render';
import { useCancelOrder } from './use-cancel-order';
import { useCreateOrder } from './use-create-order';
import { orderRefetchInterval, useOrder } from './use-order';
import { useOrders } from './use-orders';
import { useZones } from './use-zones';

afterEach(() => vi.unstubAllGlobals());

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}
const order = { id: 'o1', number: 1001, status: 'recibido' };
const call = (fetchMock: ReturnType<typeof vi.fn>, n = 0) =>
  fetchMock.mock.calls[n] as unknown as [string, RequestInit];

describe('useZones', () => {
  it('pide /api/delivery-zones y devuelve la lista', async () => {
    const f = vi.fn(async () =>
      jsonResponse({ data: [{ id: 'z', name: 'Zona 1', points: [] }] }),
    );
    vi.stubGlobal('fetch', f);
    const { wrapper } = setup();
    const { result } = renderHook(() => useZones(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0]?.name).toBe('Zona 1');
    expect(call(f)[0]).toBe('/api/delivery-zones');
  });
});

describe('useCreateOrder', () => {
  it('envía POST con Idempotency-Key y el cuerpo, y deja el pedido en la caché', async () => {
    const f = vi.fn(async () => jsonResponse(order, 201));
    vi.stubGlobal('fetch', f);
    const { wrapper, client } = setup();
    const { result } = renderHook(() => useCreateOrder(), { wrapper });
    const body = {
      items: [{ productId: 'p', quantity: 1 }],
      pointId: 'x',
      payment: {
        method: 'tarjeta_demo' as const,
        cardNumber: '4242424242424242',
      },
    };
    await act(() => result.current.mutateAsync({ body, key: 'k-1' }));
    const [url, init] = call(f);
    expect(url).toBe('/api/orders');
    expect(init.method).toBe('POST');
    expect((init.headers as Record<string, string>)['idempotency-key']).toBe(
      'k-1',
    );
    expect(JSON.parse(init.body as string)).toEqual(body);
    expect(client.getQueryData(['order', 'o1'])).toEqual(order);
  });
  it('no deja la tarjeta en la caché de mutaciones', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ statusCode: 402, message: 'x' }, 402)),
    );
    const { wrapper, client } = setup();
    const { result, unmount } = renderHook(() => useCreateOrder(), { wrapper });
    await act(async () => {
      await result.current
        .mutateAsync({
          body: {
            items: [],
            pointId: 'x',
            payment: { method: 'tarjeta_demo', cardNumber: '4242424242424242' },
          },
          key: 'k',
        })
        .catch(() => undefined);
    });
    unmount();
    await waitFor(() =>
      expect(client.getMutationCache().getAll()).toHaveLength(0),
    );
  });
  it('un 402 llega como error con su estado', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ statusCode: 402, message: 'x' }, 402)),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useCreateOrder(), { wrapper });
    await act(async () => {
      await result.current
        .mutateAsync({ body: {} as never, key: 'k' })
        .catch((e: { status: number }) => expect(e.status).toBe(402));
    });
  });
});

describe('useOrders', () => {
  it('pide la página 1 (10) y la siguiente con fetchNextPage', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({
          page: 1,
          limit: 10,
          total: 12,
          totalPages: 2,
          data: [order],
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          page: 2,
          limit: 10,
          total: 12,
          totalPages: 2,
          data: [{ ...order, id: 'o2' }],
        }),
      );
    vi.stubGlobal('fetch', f);
    const { wrapper } = setup();
    const { result } = renderHook(() => useOrders(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(call(f)[0]).toBe('/api/orders?page=1&limit=10');
    expect(result.current.hasNextPage).toBe(true);
    await act(() => result.current.fetchNextPage());
    expect(call(f, 1)[0]).toBe('/api/orders?page=2&limit=10');
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  });
});

describe('useOrder', () => {
  it('consulta /api/orders/:id', async () => {
    const f = vi.fn(async () => jsonResponse(order));
    vi.stubGlobal('fetch', f);
    const { wrapper } = setup();
    const { result } = renderHook(() => useOrder('o1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(call(f)[0]).toBe('/api/orders/o1');
  });
  it('un 404 queda como error sin reintentar', async () => {
    const f = vi.fn(async () =>
      jsonResponse({ statusCode: 404, message: 'x' }, 404),
    );
    vi.stubGlobal('fetch', f);
    const { wrapper } = setup();
    const { result } = renderHook(() => useOrder('nada'), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(f).toHaveBeenCalledTimes(1);
  });
  it('la consulta periódica solo corre si el estado no es final', () => {
    const base = order as never as Parameters<typeof orderRefetchInterval>[0];
    expect(orderRefetchInterval(undefined)).toBe(false);
    expect(orderRefetchInterval({ ...base!, status: 'recibido' })).toBe(15_000);
    expect(orderRefetchInterval({ ...base!, status: 'en_camino' })).toBe(
      15_000,
    );
    for (const status of ['entregado', 'cancelado', 'no_entregado'] as const)
      expect(orderRefetchInterval({ ...base!, status })).toBe(false);
  });
});

describe('useCancelOrder', () => {
  it('cancela y actualiza el detalle con la respuesta', async () => {
    const f = vi.fn(async () =>
      jsonResponse({ ...order, status: 'cancelado' }),
    );
    vi.stubGlobal('fetch', f);
    const { wrapper, client } = setup();
    const { result } = renderHook(() => useCancelOrder('o1'), { wrapper });
    await act(() => result.current.mutateAsync());
    expect(call(f)[0]).toBe('/api/orders/o1/cancel');
    expect(call(f)[1].method).toBe('POST');
    expect(call(f)[1].body).toBeNull();
    expect(
      (client.getQueryData(['order', 'o1']) as { status: string }).status,
    ).toBe('cancelado');
  });
  it('un 409 queda como error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ statusCode: 409, message: 'ya no' }, 409),
      ),
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useCancelOrder('o1'), { wrapper });
    await act(async () => {
      await result.current
        .mutateAsync()
        .catch((e: { status: number }) => expect(e.status).toBe(409));
    });
  });
});
