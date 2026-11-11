import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  backRound,
  dispatchOrder,
  fakeDispatchBack,
} from '../../../tests/utils/dispatch';
import { useCloseOrder } from './use-close-order';
import { useCreateRound } from './use-create-round';
import {
  QUEUE_KEY,
  ROUNDS_KEY,
  useActiveRounds,
  useDispatchQueue,
} from './use-dispatch-queue';
import { useNewReadyOrders } from './use-new-ready';
import type { RoundPage } from './types';

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

describe('consultas de despacho', () => {
  it('trae la cola y las rondas activas', async () => {
    const back = fakeDispatchBack(
      [dispatchOrder(1001), dispatchOrder(1002, 'z2')],
      [
        backRound({
          orders: [dispatchOrder(1000, 'z1', { status: 'en_camino' })],
        }),
      ],
    );
    const { wrapper } = setup();
    const queue = renderHook(() => useDispatchQueue(), { wrapper });
    const rounds = renderHook(() => useActiveRounds(), { wrapper });
    await waitFor(() => expect(queue.result.current.data).toBeDefined());
    await waitFor(() => expect(rounds.result.current.data).toBeDefined());
    expect(queue.result.current.data?.zones.map((z) => z.zoneName)).toEqual([
      'Zona 1',
      'Zona 2',
    ]);
    expect(rounds.result.current.data?.data).toHaveLength(1);
    expect(back.calls.map((c) => c.url)).toContain(
      '/api/dispatch/rounds?status=activa&limit=20',
    );
  });
});

describe('useCreateRound', () => {
  it('sin pedidos envía {} y con pedidos { orderIds }; actualiza rondas y cola', async () => {
    const a = dispatchOrder(1001);
    const b = dispatchOrder(1002);
    const back = fakeDispatchBack([a, b]);
    const { client, wrapper } = setup();
    await client.prefetchQuery({
      queryKey: QUEUE_KEY,
      queryFn: () =>
        fetch('/api/dispatch/queue').then((r) => r.json()) as Promise<never>,
    });
    await client.prefetchQuery({
      queryKey: ROUNDS_KEY,
      queryFn: () =>
        fetch('/api/dispatch/rounds?status=activa&limit=20').then((r) =>
          r.json(),
        ) as Promise<never>,
    });
    const onDone = vi.fn();
    const { result } = renderHook(() => useCreateRound({ onDone }), {
      wrapper,
    });
    await act(async () => {
      await result.current.run([a.id]);
    });
    expect(back.posts()[0]?.body).toEqual({ orderIds: [a.id] });
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'round-new-1' }),
      false,
    );
    const page = client.getQueryData<RoundPage>(ROUNDS_KEY);
    expect(page?.data).toHaveLength(1);
    await act(async () => {
      await result.current.run();
    });
    expect(back.posts()[1]?.body).toEqual({});
  });

  it('doble clic envía una sola petición', async () => {
    const back = fakeDispatchBack([dispatchOrder(1001)]);
    const { wrapper } = setup();
    const { result } = renderHook(() => useCreateRound(), { wrapper });
    await act(async () => {
      await Promise.all([result.current.run(), result.current.run()]);
    });
    expect(back.posts()).toHaveLength(1);
  });

  it('un 409 se explica y no se reintenta', async () => {
    const back = fakeDispatchBack([dispatchOrder(1001)], [], {
      failCreate: 409,
      createMessage:
        'Ya tienes 2 rondas activas; termina una antes de salir con otra.',
    });
    const { wrapper } = setup();
    const onFail = vi.fn();
    const { result } = renderHook(() => useCreateRound({ onFail }), {
      wrapper,
    });
    await act(async () => {
      await result.current.run();
    });
    expect(onFail).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'rounds-limit' }),
    );
    expect(back.posts()).toHaveLength(1);
  });

  it('corte de red: si la ronda sí salió, la encuentra al consultar', async () => {
    const back = fakeDispatchBack([dispatchOrder(1001)], [], {
      failCreate: 'network',
      createStillHappens: true,
    });
    const { client, wrapper } = setup();
    client.setQueryData(ROUNDS_KEY, {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      data: [],
    });
    const onDone = vi.fn();
    const onFail = vi.fn();
    const { result } = renderHook(() => useCreateRound({ onDone, onFail }), {
      wrapper,
    });
    await act(async () => {
      await result.current.run();
    });
    expect(back.posts()).toHaveLength(1);
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'round-new-1' }),
      true,
    );
    expect(onFail).not.toHaveBeenCalled();
  });

  it('corte de red: si no salió, lo dice y deja intentar de nuevo', async () => {
    fakeDispatchBack([dispatchOrder(1001)], [], { failCreate: 'network' });
    const { client, wrapper } = setup();
    client.setQueryData(ROUNDS_KEY, {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      data: [],
    });
    const onFail = vi.fn();
    const { result } = renderHook(() => useCreateRound({ onFail }), {
      wrapper,
    });
    await act(async () => {
      await result.current.run();
    });
    expect(onFail).toHaveBeenCalledWith({
      kind: 'ambiguous',
      messages: ['La ronda no salió: puedes intentar de nuevo.'],
    });
    expect(result.current.pending).toBe(false);
  });
});

describe('useCloseOrder', () => {
  const inRoute = (n: number) =>
    dispatchOrder(n, 'z1', { status: 'en_camino' });

  it('entrega, reemplaza el pedido en su ronda y avisa al terminar la ronda', async () => {
    const o1 = inRoute(1001);
    const o2 = inRoute(1002);
    const back = fakeDispatchBack([], [backRound({ orders: [o1, o2] })]);
    const { client, wrapper } = setup();
    await client.prefetchQuery({
      queryKey: ROUNDS_KEY,
      queryFn: () =>
        fetch('/api/dispatch/rounds?status=activa&limit=20').then((r) =>
          r.json(),
        ) as Promise<never>,
    });
    const onDone = vi.fn();
    const { result } = renderHook(() => useCloseOrder({ onDone }), { wrapper });
    await act(async () => {
      await result.current.run('deliver', o1.id);
    });
    expect(onDone).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'entregado' }),
      null,
    );
    await act(async () => {
      await result.current.run('fail', o2.id, '  Nadie en el punto  ');
    });
    expect(back.posts().at(-1)?.body).toEqual({ reason: 'Nadie en el punto' });
    expect(onDone).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 'no_entregado' }),
      expect.objectContaining({ delivered: 1, failed: 1, pending: 0 }),
    );
    expect(client.getQueryData<RoundPage>(ROUNDS_KEY)?.data).toEqual([]);
  });

  it('doble clic envía una sola petición', async () => {
    const o1 = inRoute(1001);
    const back = fakeDispatchBack(
      [],
      [backRound({ orders: [o1, inRoute(1002)] })],
    );
    const { wrapper } = setup();
    const { result } = renderHook(() => useCloseOrder(), { wrapper });
    await act(async () => {
      await Promise.all([
        result.current.run('deliver', o1.id),
        result.current.run('deliver', o1.id),
      ]);
    });
    expect(back.posts()).toHaveLength(1);
  });

  it('409: explica y no es reintentable', async () => {
    const o1 = inRoute(1001);
    fakeDispatchBack([], [backRound({ orders: [o1] })], {
      failClose: { 1001: 409 },
    });
    const { wrapper } = setup();
    const onFail = vi.fn();
    const { result } = renderHook(() => useCloseOrder({ onFail }), { wrapper });
    await act(async () => {
      await result.current.run('deliver', o1.id);
    });
    expect(onFail).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'conflict' }),
      false,
    );
  });

  it('corte de red: si el pedido sigue en camino ofrece reintentar; si ya cambió, lo explica', async () => {
    const o1 = inRoute(1001);
    const o2 = inRoute(1002);
    fakeDispatchBack([], [backRound({ orders: [o1, o2] })], {
      failClose: { 1001: 'network', 1002: 'network' },
    });
    const { wrapper } = setup();
    const onFail = vi.fn();
    const { result } = renderHook(() => useCloseOrder({ onFail }), { wrapper });
    await act(async () => {
      await result.current.run('deliver', o1.id);
    });
    expect(onFail).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'ambiguous' }),
      true,
    );

    vi.unstubAllGlobals();
    fakeDispatchBack([], [backRound({ orders: [o1, o2] })], {
      failClose: { 1001: 'network' },
      closeStillHappens: true,
    });
    await act(async () => {
      await result.current.run('deliver', o1.id);
    });
    expect(onFail).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'conflict' }),
      false,
    );
  });
});

describe('useNewReadyOrders', () => {
  let visibility: DocumentVisibilityState = 'visible';
  beforeEach(() => {
    visibility = 'visible';
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });
  });
  const queueOf = (...orders: ReturnType<typeof dispatchOrder>[]) => ({
    suggestedZoneId: 'zone-1',
    zones: [{ zoneId: 'zone-1', zoneName: 'Zona 1', oldestNumber: 1, orders }],
  });

  it('la primera carga no avisa; uno nuevo sí; oculto suma al contador y se limpia al volver', () => {
    const { client, wrapper } = setup();
    const { result } = renderHook(() => useNewReadyOrders(), { wrapper });
    const a = dispatchOrder(1001);
    const b = dispatchOrder(1002);
    act(() => void client.setQueryData(QUEUE_KEY, queueOf(a)));
    expect(result.current.announcement).toBe('');
    act(() => void client.setQueryData(QUEUE_KEY, queueOf(a, b)));
    expect(result.current.announcement).toBe(
      'Pedido #1002 listo para repartir',
    );
    expect(result.current.unseen).toBe(0);
    act(() => {
      visibility = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    act(
      () =>
        void client.setQueryData(QUEUE_KEY, queueOf(a, b, dispatchOrder(1003))),
    );
    expect(result.current.unseen).toBe(1);
    act(() => {
      visibility = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.unseen).toBe(0);
  });
});
