import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  backMovement,
  backProduct,
  movementPage,
  productPage,
} from '../../../tests/utils/inventory';
import { jsonResponse } from '../../../tests/utils/render';
import { useCreateMovement } from './use-create-movement';
import { movementsUrl, useMovements } from './use-movements';
import { PRODUCTS_POLL_MS, useProducts } from './use-products';
import { useSetSoldOut } from './use-sold-out';
import { toStaffProduct, type ProductPage } from './types';

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

describe('useProducts', () => {
  it('pide el catálogo (hasta 100) y descarta el costo', async () => {
    const f = vi.fn<typeof fetch>(async () =>
      jsonResponse(productPage([backProduct()])),
    );
    vi.stubGlobal('fetch', f);
    const { wrapper } = setup();
    const { result } = renderHook(() => useProducts(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(f.mock.calls[0]?.[0]).toBe('/api/products?limit=100');
    expect(result.current.data?.data[0]).not.toHaveProperty('cost');
    expect(PRODUCTS_POLL_MS).toBe(30_000);
  });
});

describe('useSetSoldOut', () => {
  it('envía { soldOut }, actualiza la fila con la respuesta y avisa', async () => {
    const product = backProduct({ id: 'p1' });
    const other = backProduct({ id: 'p2' });
    const updated = { ...product, soldOut: true, available: false };
    const f = vi.fn<typeof fetch>(async (url) =>
      String(url).endsWith('/sold-out')
        ? jsonResponse(updated)
        : jsonResponse(productPage([updated, other])),
    );
    vi.stubGlobal('fetch', f);
    const { client, wrapper } = setup();
    client.setQueryData<ProductPage>(['products'], {
      ...productPage([]),
      data: [product, other].map(toStaffProduct),
    });
    const done = vi.fn();
    const { result } = renderHook(() => useSetSoldOut(done), { wrapper });
    await act(async () => {
      await result.current.mutateAsync({ id: 'p1', soldOut: true });
    });
    const call = f.mock.calls[0]!;
    expect(call[0]).toBe('/api/products/p1/sold-out');
    expect((call[1] as RequestInit).method).toBe('PATCH');
    expect(JSON.parse(String((call[1] as RequestInit).body))).toEqual({
      soldOut: true,
    });
    expect(
      client.getQueryData<ProductPage>(['products'])?.data[0]?.soldOut,
    ).toBe(true);
    expect(done).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'p1', soldOut: true }),
    );
  });

  it('un 404 avisa con onFail y vuelve a consultar el catálogo', async () => {
    const f = vi.fn<typeof fetch>(async (url, init) =>
      (init as RequestInit | undefined)?.method === 'PATCH'
        ? jsonResponse(
            { statusCode: 404, message: 'Producto no encontrado' },
            404,
          )
        : jsonResponse(productPage([])),
    );
    vi.stubGlobal('fetch', f);
    const { client, wrapper } = setup();
    client.setQueryData(['products'], productPage([]));
    const fail = vi.fn();
    const { result } = renderHook(() => useSetSoldOut(undefined, fail), {
      wrapper,
    });
    await act(async () => {
      await result.current
        .mutateAsync({ id: 'p1', soldOut: true })
        .catch(() => undefined);
    });
    expect(fail).toHaveBeenCalledTimes(1);
    expect(client.getQueryState(['products'])?.isInvalidated).toBe(true);
  });
});

describe('useCreateMovement', () => {
  const input = {
    productId: 'p1',
    type: 'IN' as const,
    quantity: 10,
    reason: 'Compra',
  };

  it('envía el cuerpo exacto y deja el saldo confirmado por el back en la fila', async () => {
    const p1 = backProduct({ id: 'p1', stock: 20 });
    const created = {
      movement: backMovement({ productId: 'p1', quantity: 10 }),
      stock: 30,
    };
    const f = vi.fn<typeof fetch>(async (url) =>
      String(url) === '/api/movements'
        ? jsonResponse(created, 201)
        : jsonResponse(productPage([{ ...p1, stock: 30 }])),
    );
    vi.stubGlobal('fetch', f);
    const { client, wrapper } = setup();
    client.setQueryData<ProductPage>(['products'], {
      ...productPage([]),
      data: [toStaffProduct(p1)],
    });
    const done = vi.fn();
    const { result } = renderHook(() => useCreateMovement(done), { wrapper });
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    const post = f.mock.calls[0]!;
    expect((post[1] as RequestInit).method).toBe('POST');
    expect(JSON.parse(String((post[1] as RequestInit).body))).toEqual(input);
    expect(client.getQueryData<ProductPage>(['products'])?.data[0]?.stock).toBe(
      30,
    );
    expect(done).toHaveBeenCalledWith(created);
  });

  it('nunca se reintenta solo: un fallo de red envía una sola petición', async () => {
    const f = vi.fn<typeof fetch>(async () => {
      throw new TypeError('network');
    });
    vi.stubGlobal('fetch', f);
    const { wrapper } = setup();
    const fail = vi.fn();
    const { result } = renderHook(() => useCreateMovement(undefined, fail), {
      wrapper,
    });
    await act(async () => {
      await result.current.mutateAsync(input).catch(() => undefined);
    });
    const posts = f.mock.calls.filter(([u]) => String(u) === '/api/movements');
    expect(posts).toHaveLength(1);
    expect(fail).toHaveBeenCalledTimes(1);
  });
});

describe('useMovements', () => {
  it('arma la URL con página, 20 por página y filtros', () => {
    expect(movementsUrl({ page: 1, productId: null, type: null })).toBe(
      '/api/movements?page=1&limit=20',
    );
    expect(movementsUrl({ page: 2, productId: 'p1', type: 'OUT' })).toBe(
      '/api/movements?page=2&limit=20&productId=p1&type=OUT',
    );
  });
  it('trae la página pedida', async () => {
    const f = vi.fn<typeof fetch>(async () =>
      jsonResponse(movementPage([backMovement()])),
    );
    vi.stubGlobal('fetch', f);
    const { wrapper } = setup();
    const { result } = renderHook(
      () => useMovements({ page: 1, productId: null, type: 'IN' }),
      { wrapper },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(f.mock.calls[0]?.[0]).toBe('/api/movements?page=1&limit=20&type=IN');
  });
});
