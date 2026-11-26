import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../../tests/utils/render';
import { kitchenOrder, kitchenPage } from '../../../tests/utils/kitchen';
import { useKitchenAction } from './use-kitchen-action';
import { useKitchenCancel } from './use-kitchen-cancel';
import { kitchenRefetchInterval, useKitchenQueue } from './use-kitchen-queue';

afterEach(() => vi.unstubAllGlobals());

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe('useKitchenQueue', () => {
  it('pide la cola por estado, hasta 100', async () => {
    const f = vi.fn<typeof fetch>(async () =>
      jsonResponse(kitchenPage([kitchenOrder()])),
    );
    vi.stubGlobal('fetch', f);
    const { wrapper } = setup();
    const { result } = renderHook(() => useKitchenQueue('en_preparacion'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(f.mock.calls[0]?.[0]).toBe(
      '/api/kitchen/orders?status=en_preparacion&limit=100',
    );
  });

  it('el sondeo de 15 s es solo el respaldo del canal en vivo', () => {
    expect(kitchenRefetchInterval('live')).toBe(false);
    for (const live of [
      'off',
      'connecting',
      'reconnecting',
      'stopped',
    ] as const)
      expect(kitchenRefetchInterval(live)).toBe(15_000);
  });
});

describe('useKitchenAction', () => {
  const a = kitchenOrder({ number: 1001 });
  const b = kitchenOrder({ number: 1002 });

  it('empezar mueve el pedido de «Por preparar» a «En preparación» con la respuesta', async () => {
    const started = {
      ...a,
      status: 'en_preparacion' as const,
      events: [
        ...a.events,
        { status: 'en_preparacion' as const, at: '2026-11-10T18:05:00.000Z' },
      ],
    };
    const f = vi.fn<typeof fetch>(async () => jsonResponse(started));
    vi.stubGlobal('fetch', f);
    const { client, wrapper } = setup();
    client.setQueryData(['kitchen', 'recibido'], kitchenPage([a, b]));
    client.setQueryData(['kitchen', 'en_preparacion'], kitchenPage([]));
    const { result } = renderHook(() => useKitchenAction('start'), { wrapper });
    await act(() => result.current.mutateAsync(a.id));

    expect(f.mock.calls[0]?.[0]).toBe(`/api/kitchen/orders/${a.id}/start`);
    expect((f.mock.calls[0]?.[1] as RequestInit).method).toBe('POST');
    const recibido = client.getQueryData<{
      data: { number: number }[];
      total: number;
    }>(['kitchen', 'recibido']);
    const prep = client.getQueryData<{
      data: { number: number }[];
      total: number;
    }>(['kitchen', 'en_preparacion']);
    expect(recibido?.data.map((o) => o.number)).toEqual([1002]);
    expect(recibido?.total).toBe(1);
    expect(prep?.data.map((o) => o.number)).toEqual([1001]);
    expect(prep?.total).toBe(1);
  });

  it('marcar listo mueve el pedido a «Listos»', async () => {
    const prepping = { ...a, status: 'en_preparacion' as const };
    const f = vi.fn<typeof fetch>(async () =>
      jsonResponse({ ...prepping, status: 'listo' }),
    );
    vi.stubGlobal('fetch', f);
    const { client, wrapper } = setup();
    client.setQueryData(['kitchen', 'en_preparacion'], kitchenPage([prepping]));
    client.setQueryData(['kitchen', 'listo'], kitchenPage([]));
    const { result } = renderHook(() => useKitchenAction('ready'), { wrapper });
    await act(() => result.current.mutateAsync(a.id));
    expect(f.mock.calls[0]?.[0]).toBe(`/api/kitchen/orders/${a.id}/ready`);
    expect(
      client.getQueryData<{ data: unknown[] }>(['kitchen', 'listo'])?.data,
    ).toHaveLength(1);
    expect(
      client.getQueryData<{ data: unknown[] }>(['kitchen', 'en_preparacion'])
        ?.data,
    ).toHaveLength(0);
  });

  it('un 409 no mueve nada y marca las colas para volver a consultarlas', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ statusCode: 409, message: 'x' }, 409)),
    );
    const { client, wrapper } = setup();
    client.setQueryData(['kitchen', 'recibido'], kitchenPage([a]));
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useKitchenAction('start'), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(a.id).catch(() => undefined);
    });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(
      client.getQueryData<{ data: unknown[] }>(['kitchen', 'recibido'])?.data,
    ).toHaveLength(1);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['kitchen'] });
  });
});

describe('useKitchenCancel', () => {
  it('cancela con el motivo y saca el pedido de las colas', async () => {
    const a = kitchenOrder({ number: 1001 });
    const f = vi.fn<typeof fetch>(async () =>
      jsonResponse({ ...a, status: 'cancelado', cancelReason: 'Sin café' }),
    );
    vi.stubGlobal('fetch', f);
    const { client, wrapper } = setup();
    client.setQueryData(['kitchen', 'recibido'], kitchenPage([a]));
    client.setQueryData(['kitchen', 'en_preparacion'], kitchenPage([]));
    const { result } = renderHook(() => useKitchenCancel(), { wrapper });
    await act(() =>
      result.current.mutateAsync({ id: a.id, reason: 'Sin café' }),
    );

    expect(f.mock.calls[0]?.[0]).toBe(`/api/orders/${a.id}/cancel`);
    const init = f.mock.calls[0]?.[1] as RequestInit;
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({ reason: 'Sin café' });
    expect(
      client.getQueryData<{ data: unknown[] }>(['kitchen', 'recibido'])?.data,
    ).toHaveLength(0);
  });
});
