import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  backMovement,
  backProduct,
  productPage,
} from '../../../tests/utils/inventory';
import { jsonResponse } from '../../../tests/utils/render';
import { usePrepareDay } from './use-prepare-day';

afterEach(() => vi.unstubAllGlobals());

const wrapper = ({ children }: { children: ReactNode }) => {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

type Post = {
  productId: string;
  type: string;
  quantity: number;
  reason: string;
};

/** Back falso: catálogo actual, un POST por vez (mide la concurrencia) y fallos por producto. */
function fakeBack(
  products: ReturnType<typeof backProduct>[],
  fail: Record<string, number | 'network'> = {},
  opts: { catalogFails?: boolean } = {},
) {
  const posts: Post[] = [];
  let inFlight = 0;
  let maxInFlight = 0;
  const f = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    if (init?.method === 'POST' && url === '/api/movements') {
      const body = JSON.parse(String(init.body)) as Post;
      posts.push(body);
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((r) => setTimeout(r, 5));
      inFlight -= 1;
      const failure = fail[body.productId];
      if (failure === 'network') throw new TypeError('network');
      if (failure)
        return jsonResponse(
          { statusCode: failure, message: 'Saldo insuficiente' },
          failure,
        );
      const p = products.find((x) => x.id === body.productId)!;
      p.stock += body.type === 'IN' ? body.quantity : -body.quantity;
      return jsonResponse(
        {
          movement: backMovement({
            productId: p.id,
            type: body.type as 'IN' | 'OUT',
            quantity: body.quantity,
            reason: body.reason,
          }),
          stock: p.stock,
        },
        201,
      );
    }
    if (url.startsWith('/api/products')) {
      if (opts.catalogFails) throw new TypeError('network');
      return jsonResponse(productPage(products.map((p) => ({ ...p }))));
    }
    return jsonResponse({}, 404);
  });
  vi.stubGlobal('fetch', f);
  return { posts, maxInFlight: () => maxInFlight };
}

describe('usePrepareDay', () => {
  it('calcula con el saldo más reciente y envía un movimiento por producto, en serie, con el motivo del lote', async () => {
    const capu = backProduct({ id: 'capu', name: 'Capuchino', stock: 25 });
    const pan = backProduct({ id: 'pan', name: 'Pandebono', stock: 30 });
    const back = fakeBack([capu, pan]);
    const { result } = renderHook(() => usePrepareDay(), { wrapper });
    await act(async () => {
      await result.current.run({ capu: '50', pan: '10' }, 'Preparar el día');
    });
    expect(back.posts).toEqual([
      {
        productId: 'capu',
        type: 'IN',
        quantity: 25,
        reason: 'Preparar el día',
      },
      {
        productId: 'pan',
        type: 'OUT',
        quantity: 20,
        reason: 'Preparar el día',
      },
    ]);
    expect(back.maxInFlight()).toBe(1);
    expect(result.current.state.phase).toBe('done');
    expect(result.current.state.progress).toEqual({ done: 2, total: 2 });
    expect(result.current.state.results.capu).toEqual({
      status: 'ok',
      type: 'IN',
      quantity: 25,
      stock: 50,
    });
    expect(result.current.state.results.pan).toMatchObject({
      status: 'ok',
      stock: 10,
    });
  });

  it('una fila que ya cuadra se omite y no se envía', async () => {
    const back = fakeBack([backProduct({ id: 'a', stock: 40 })]);
    const { result } = renderHook(() => usePrepareDay(), { wrapper });
    await act(async () => {
      await result.current.run({ a: '40' }, 'Preparar el día');
    });
    expect(back.posts).toEqual([]);
    expect(result.current.state.results.a).toEqual({ status: 'omitted' });
    expect(result.current.state.progress.total).toBe(0);
  });

  it('un fallo no detiene el lote: las demás filas se aplican', async () => {
    const back = fakeBack(
      [
        backProduct({ id: 'a', stock: 0 }),
        backProduct({ id: 'b', stock: 0 }),
        backProduct({ id: 'c', stock: 0 }),
      ],
      { b: 409 },
    );
    const { result } = renderHook(() => usePrepareDay(), { wrapper });
    await act(async () => {
      await result.current.run({ a: '5', b: '5', c: '5' }, 'x');
    });
    expect(back.posts.map((p) => p.productId)).toEqual(['a', 'b', 'c']);
    expect(result.current.state.results.a?.status).toBe('ok');
    expect(result.current.state.results.b).toEqual({
      status: 'failed',
      messages: ['Saldo insuficiente'],
    });
    expect(result.current.state.results.c?.status).toBe('ok');
  });

  it('un corte de red deja la fila ambigua, sin reintentar, y las ambiguas bloqueadas no se reenvían', async () => {
    const back = fakeBack(
      [backProduct({ id: 'a', stock: 0 }), backProduct({ id: 'b', stock: 0 })],
      { a: 'network' },
    );
    const { result } = renderHook(() => usePrepareDay(), { wrapper });
    await act(async () => {
      await result.current.run({ a: '5', b: '5' }, 'x');
    });
    expect(back.posts.filter((p) => p.productId === 'a')).toHaveLength(1);
    expect(result.current.state.results.a?.status).toBe('ambiguous');
    expect(result.current.state.results.b?.status).toBe('ok');

    await act(async () => {
      await result.current.run({ a: '5' }, 'x', new Set(['a']));
    });
    expect(back.posts.filter((p) => p.productId === 'a')).toHaveLength(1);

    act(() => result.current.clear('a'));
    expect(result.current.state.results.a).toBeUndefined();
  });

  it('si no se puede consultar el catálogo no se envía nada', async () => {
    const back = fakeBack(
      [backProduct({ id: 'a', stock: 0 })],
      {},
      { catalogFails: true },
    );
    const { result } = renderHook(() => usePrepareDay(), { wrapper });
    await act(async () => {
      await result.current.run({ a: '5' }, 'x');
    });
    expect(back.posts).toEqual([]);
    expect(result.current.state.fatal).toMatch(/no se aplicó nada/);
    expect(result.current.state.phase).toBe('done');
  });

  it('una segunda llamada mientras corre el lote se ignora', async () => {
    const back = fakeBack([backProduct({ id: 'a', stock: 0 })]);
    const { result } = renderHook(() => usePrepareDay(), { wrapper });
    await act(async () => {
      await Promise.all([
        result.current.run({ a: '5' }, 'x'),
        result.current.run({ a: '5' }, 'x'),
      ]);
    });
    expect(back.posts).toHaveLength(1);
  });

  it('al salir de la pantalla no se envían más filas', async () => {
    const back = fakeBack([
      backProduct({ id: 'a', stock: 0 }),
      backProduct({ id: 'b', stock: 0 }),
      backProduct({ id: 'c', stock: 0 }),
    ]);
    const { result, unmount } = renderHook(() => usePrepareDay(), { wrapper });
    let running: Promise<unknown> = Promise.resolve();
    await act(async () => {
      running = result.current.run({ a: '5', b: '5', c: '5' }, 'x');
      await new Promise((r) => setTimeout(r, 8));
      unmount();
    });
    await running;
    expect(back.posts.length).toBeLessThan(3);
    expect(back.posts.length).toBeGreaterThanOrEqual(1);
  });
});
