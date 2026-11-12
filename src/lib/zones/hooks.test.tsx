import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { POINT_ID } from '../../../tests/mock-api/orders';
import { fakeZonesBack } from '../../../tests/utils/zones';
import type { AdminZone } from './types';
import { useAdminZones } from './use-admin-zones';
import {
  useCreatePoint,
  useCreateZone,
  useDeletePoint,
  useDeleteZone,
  useUpdatePoint,
  useUpdateZone,
} from './use-zone-actions';

afterEach(() => vi.unstubAllGlobals());

const ZONE1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ZONE2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const spy = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper, spy };
}
const keys = (spy: ReturnType<typeof setup>['spy']) =>
  spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));

async function zoneNamed(back: ReturnType<typeof fakeZonesBack>, name: string) {
  const all = (back.store.allZones().body as { data: AdminZone[] }).data;
  return all.find((z) => z.name === name)!;
}

describe('useAdminZones', () => {
  it('pide todas las zonas con sus puntos', async () => {
    const back = fakeZonesBack();
    const { wrapper } = setup();
    const { result } = renderHook(() => useAdminZones(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(back.lists()).toHaveLength(1);
    expect(result.current.data?.map((z) => z.name)).toEqual([
      'Zona 1',
      'Zona 2',
    ]);
  });
});

describe('acciones de zonas', () => {
  it('crea una zona con el cuerpo exacto e invalida la lista del admin y la pública', async () => {
    const back = fakeZonesBack();
    const { wrapper, spy } = setup();
    const done = vi.fn();
    const { result } = renderHook(() => useCreateZone({ onDone: done }), {
      wrapper,
    });
    await act(() => result.current.run({ name: 'Zona 3' }));
    expect(back.posts()[0]).toMatchObject({
      url: '/api/delivery-zones',
      body: { name: 'Zona 3' },
    });
    expect(done).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Zona 3' }),
      'sent',
    );
    expect(keys(spy)).toEqual(
      expect.arrayContaining(['["admin-zones"]', '["zones"]']),
    );
  });

  it('un nombre repetido llega como «duplicate» con el texto del back', async () => {
    fakeZonesBack();
    const { wrapper } = setup();
    const fail = vi.fn();
    const { result } = renderHook(() => useCreateZone({ onFail: fail }), {
      wrapper,
    });
    await act(() => result.current.run({ name: 'zona 1' }));
    expect(fail).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'duplicate',
        fields: { name: 'Ya existe una zona con ese nombre.' },
      }),
    );
  });

  it('el doble clic no duplica y no hay reintento automático', async () => {
    const back = fakeZonesBack({ post: 'network' });
    const { wrapper } = setup();
    const fail = vi.fn();
    const { result } = renderHook(() => useCreateZone({ onFail: fail }), {
      wrapper,
    });
    await act(async () => {
      void result.current.run({ name: 'Zona 3' });
      void result.current.run({ name: 'Zona 3' });
    });
    await waitFor(() => expect(fail).toHaveBeenCalledTimes(1));
    expect(back.posts()).toHaveLength(1);
  });

  it('tras un corte con efecto se confirma consultando y se da por creada', async () => {
    const back = fakeZonesBack({ post: 'network-saved' });
    const { wrapper } = setup();
    const done = vi.fn();
    const { result } = renderHook(() => useCreateZone({ onDone: done }), {
      wrapper,
    });
    await act(() => result.current.run({ name: 'Zona 3' }));
    expect(done).toHaveBeenCalledWith(
      expect.objectContaining({ name: 'Zona 3' }),
      'recovered',
    );
    expect(back.posts()).toHaveLength(1);
  });

  it('tras un corte sin efecto, falla como ambigua y no crea nada', async () => {
    const back = fakeZonesBack({ post: 'network' });
    const { wrapper } = setup();
    const fail = vi.fn();
    const { result } = renderHook(() => useCreateZone({ onFail: fail }), {
      wrapper,
    });
    await act(() => result.current.run({ name: 'Zona 3' }));
    expect(fail).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'ambiguous' }),
    );
    expect(back.posts()).toHaveLength(1);
  });

  it('renombra y activa/desactiva con PATCH de solo lo enviado', async () => {
    const back = fakeZonesBack();
    const { wrapper } = setup();
    const { result } = renderHook(() => useUpdateZone(), { wrapper });
    const zone = await zoneNamed(back, 'Zona 2');
    await act(() => result.current.run({ zone, body: { active: false } }));
    expect(back.patches()[0]).toMatchObject({
      url: `/api/delivery-zones/${zone.id}`,
      body: { active: false },
    });
    expect((await zoneNamed(back, 'Zona 2')).active).toBe(false);
  });

  it('elimina una zona vacía; con puntos el back responde 409 con su texto', async () => {
    const back = fakeZonesBack();
    const { wrapper } = setup();
    const fail = vi.fn();
    const done = vi.fn();
    const { result } = renderHook(
      () => useDeleteZone({ onFail: fail, onDone: done }),
      { wrapper },
    );
    await act(async () => {
      await result.current.run(await zoneNamed(back, 'Zona 1'));
    });
    expect(fail).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'conflict',
        messages: ['La zona tiene puntos; muévelos o elimínalos antes.'],
      }),
    );
    const created = (back.store.createZone({ name: 'Vacía' }).body as AdminZone)
      .id;
    await act(async () => {
      await result.current.run({ id: created } as AdminZone);
    });
    expect(done).toHaveBeenCalledWith(null, 'sent');
  });

  it('una zona con rondas da 409 «history» con el texto del back', async () => {
    const back = fakeZonesBack({ usedZones: [] });
    const created = back.store.createZone({ name: 'Con rondas' })
      .body as AdminZone;
    back.usedZones.add(created.id);
    const { wrapper } = setup();
    const fail = vi.fn();
    const { result } = renderHook(() => useDeleteZone({ onFail: fail }), {
      wrapper,
    });
    await act(() => result.current.run(created));
    expect(fail).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'history',
        messages: [
          'La zona tiene rondas de despacho; desactívala en vez de eliminarla.',
        ],
      }),
    );
  });
});

describe('acciones de puntos', () => {
  it('crea un punto con el cuerpo exacto', async () => {
    const back = fakeZonesBack();
    const { wrapper } = setup();
    const { result } = renderHook(() => useCreatePoint(), { wrapper });
    await act(() =>
      result.current.run({ zoneId: ZONE1, name: 'Auditorio', floors: 2 }),
    );
    expect(back.posts()[0]).toMatchObject({
      url: '/api/delivery-points',
      body: { zoneId: ZONE1, name: 'Auditorio', floors: 2 },
    });
  });

  it('un nombre repetido en cualquier zona llega como «duplicate»', async () => {
    fakeZonesBack();
    const { wrapper } = setup();
    const fail = vi.fn();
    const { result } = renderHook(() => useCreatePoint({ onFail: fail }), {
      wrapper,
    });
    await act(() => result.current.run({ zoneId: ZONE2, name: 'Edificio A' }));
    expect(fail).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'duplicate' }),
    );
  });

  it('mover y editar con null; tras un corte con efecto se confirma comparando lo guardado', async () => {
    const back = fakeZonesBack({ patch: 'network-saved' });
    const { wrapper } = setup();
    const done = vi.fn();
    const { result } = renderHook(() => useUpdatePoint({ onDone: done }), {
      wrapper,
    });
    const zone = await zoneNamed(back, 'Zona 1');
    const p = zone.points.find((x) => x.id === POINT_ID.edificioA)!;
    await act(() =>
      result.current.run({
        point: p,
        body: { zoneId: ZONE2, hint: null, floors: null },
      }),
    );
    expect(done).toHaveBeenCalledWith(expect.anything(), 'recovered');
    const moved = (await zoneNamed(back, 'Zona 2')).points.find(
      (x) => x.id === POINT_ID.edificioA,
    );
    expect(moved).toMatchObject({ hint: null, floors: null, zoneId: ZONE2 });
  });

  it('eliminar un punto con pedidos da 409 «history» con el texto del back; uno libre se elimina', async () => {
    const back = fakeZonesBack({ usedPoints: [POINT_ID.canchas] });
    const { wrapper } = setup();
    const fail = vi.fn();
    const done = vi.fn();
    const { result } = renderHook(
      () => useDeletePoint({ onFail: fail, onDone: done }),
      { wrapper },
    );
    const zone2 = await zoneNamed(back, 'Zona 2');
    const canchas = zone2.points.find((p) => p.id === POINT_ID.canchas)!;
    const cafeteria = zone2.points.find((p) => p.id === POINT_ID.cafeteria)!;
    await act(() => result.current.run(canchas));
    expect(fail).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'history',
        messages: ['El punto tiene pedidos; desactívalo en vez de eliminarlo.'],
      }),
    );
    await act(() => result.current.run(cafeteria));
    expect(done).toHaveBeenCalledWith(null, 'sent');
    expect(back.deletes()).toHaveLength(2);
  });
});
