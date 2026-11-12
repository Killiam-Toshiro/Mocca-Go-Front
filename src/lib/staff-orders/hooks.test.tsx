import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useKitchenCancel } from '@/lib/kitchen/use-kitchen-cancel';
import { kitchenOrder, kitchenPage } from '../../../tests/utils/kitchen';
import { jsonResponse } from '../../../tests/utils/render';
import { useStaffOrder } from './use-staff-order';
import { useStaffOrders } from './use-staff-orders';

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

describe('pedidos del personal', () => {
  it('lista con página y filtro de estado', async () => {
    const f = vi.fn<typeof fetch>(async () =>
      jsonResponse(kitchenPage([kitchenOrder()])),
    );
    vi.stubGlobal('fetch', f);
    const { wrapper } = setup();
    const { result } = renderHook(() => useStaffOrders(2, 'listo'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(f.mock.calls[0]?.[0]).toBe(
      '/api/orders?page=2&limit=20&status=listo',
    );
  });

  it('pide el detalle por id', async () => {
    const order = kitchenOrder();
    const f = vi.fn<typeof fetch>(async () => jsonResponse(order));
    vi.stubGlobal('fetch', f);
    const { wrapper } = setup();
    const { result } = renderHook(() => useStaffOrder(order.id), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(f.mock.calls[0]?.[0]).toBe(`/api/orders/${order.id}`);
  });

  it('cancelar desde cocina también refresca la lista y el detalle del personal', async () => {
    const order = kitchenOrder();
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        jsonResponse({ ...order, status: 'cancelado' }),
      ),
    );
    const { client, wrapper } = setup();
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useKitchenCancel(), { wrapper });
    await act(() => result.current.mutateAsync({ id: order.id, reason: 'x' }));
    const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(keys).toContain('["staff-orders"]');
    expect(keys).toContain('["staff-order"]');
    expect(keys).toContain('["kitchen"]');
  });
});
