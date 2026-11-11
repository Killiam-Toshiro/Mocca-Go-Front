import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  customerFixture,
  fakeUsersBack,
  staffFixtures,
  userFixture,
} from '../../../tests/utils/users';
import { GENERIC_PASSWORD } from './generic-password';
import type { CreateUserValues } from './schemas';
import { useChangeRole } from './use-change-role';
import { useCreateUser } from './use-create-user';
import { useDeleteUser } from './use-delete-user';
import { useUpdateUser } from './use-update-user';
import { usersUrl, useUsers } from './use-users';

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

const values: CreateUserValues = {
  username: 'nuevo.op',
  role: 'operador',
  fullName: '',
  phone: '',
  password: GENERIC_PASSWORD,
};

describe('usersUrl / useUsers', () => {
  it('arma page, limit, search y role (Personal = tres roles)', () => {
    expect(usersUrl({ page: 2, search: ' ana ', role: 'personal' })).toBe(
      '/api/users?page=2&limit=20&search=ana&role=admin%2Coperador%2Crepartidor',
    );
    expect(usersUrl({ page: 1, search: '', role: 'todos' })).toBe(
      '/api/users?page=1&limit=20',
    );
    expect(usersUrl({ page: 1, search: '', role: 'cliente' }, 100)).toBe(
      '/api/users?page=1&limit=100&role=cliente',
    );
  });

  it('consulta al servidor con los parámetros y conserva la lista anterior al cambiar', async () => {
    const back = fakeUsersBack([...staffFixtures(), customerFixture()]);
    const { wrapper } = setup();
    const { result, rerender } = renderHook(({ f }) => useUsers(f), {
      wrapper,
      initialProps: { f: { page: 1, search: '', role: 'personal' as const } },
    });
    await waitFor(() => expect(result.current.data?.total).toBe(3));
    back.state.listDelayMs = 50;
    rerender({ f: { page: 1, search: 'carlos', role: 'personal' } });
    expect(result.current.data?.total).toBe(3);
    expect(result.current.isPlaceholderData).toBe(true);
    await waitFor(() => expect(result.current.data?.total).toBe(1));
    expect(back.lists().at(-1)?.url).toContain('search=carlos');
  });
});

describe('useCreateUser', () => {
  it('envía un solo POST con el cuerpo exacto y avisa', async () => {
    const back = fakeUsersBack();
    const { wrapper } = setup();
    const onDone = vi.fn();
    const { result } = renderHook(() => useCreateUser({ onDone }), { wrapper });
    await act(async () => {
      void result.current.run(values);
      void result.current.run(values);
    });
    expect(back.posts()).toHaveLength(1);
    expect(back.posts()[0]?.body).toEqual({
      username: 'nuevo.op',
      password: GENERIC_PASSWORD,
      role: 'operador',
    });
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'nuevo.op' }),
      'sent',
    );
  });

  it('409 de usuario repetido llega como duplicado', async () => {
    fakeUsersBack(staffFixtures(), {
      post: { status: 409, message: 'El username ya existe.' },
    });
    const { wrapper } = setup();
    const onFail = vi.fn();
    const { result } = renderHook(() => useCreateUser({ onFail }), { wrapper });
    await act(() => result.current.run(values));
    expect(onFail).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'duplicate' }),
    );
  });

  it('corte de red con el usuario ya creado: se da por creado y no se reintenta', async () => {
    const back = fakeUsersBack(staffFixtures(), { post: 'network-saved' });
    const { wrapper } = setup();
    const onDone = vi.fn();
    const { result } = renderHook(() => useCreateUser({ onDone }), { wrapper });
    await act(() => result.current.run(values));
    expect(back.posts()).toHaveLength(1);
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ username: 'nuevo.op' }),
      'recovered',
    );
  });

  it('corte de red sin crearse: falla ambiguo y no reintenta solo', async () => {
    const back = fakeUsersBack(staffFixtures(), { post: 'network' });
    const { wrapper } = setup();
    const onFail = vi.fn();
    const { result } = renderHook(() => useCreateUser({ onFail }), { wrapper });
    await act(() => result.current.run(values));
    expect(back.posts()).toHaveLength(1);
    expect(onFail).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'ambiguous' }),
    );
  });
});

describe('useUpdateUser', () => {
  const user = userFixture({
    id: 'u-op',
    fullName: 'Ana',
    phone: '+573001234567',
  });

  it('envía solo lo recibido y no envía nada si no hay cambios', async () => {
    const back = fakeUsersBack([user]);
    const { wrapper } = setup();
    const { result } = renderHook(() => useUpdateUser(), { wrapper });
    await act(() => result.current.run(user, {}));
    expect(back.patches()).toHaveLength(0);
    await act(() => result.current.run(user, { fullName: 'Ana M.' }));
    expect(back.patches()[0]?.body).toEqual({ fullName: 'Ana M.' });
    expect(back.patches()[0]?.url).toBe('/api/users/u-op');
  });

  it('corte con el cambio aplicado: se confirma consultando', async () => {
    fakeUsersBack([user], { patch: 'network-saved' });
    const { wrapper } = setup();
    const onDone = vi.fn();
    const { result } = renderHook(() => useUpdateUser({ onDone }), { wrapper });
    await act(() => result.current.run(user, { fullName: 'Ana M.' }));
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'Ana M.' }),
      'recovered',
    );
  });

  it('una contraseña no se puede comprobar: el corte explica las dos posibilidades', async () => {
    const back = fakeUsersBack([user], { patch: 'network' });
    const { wrapper } = setup();
    const onFail = vi.fn();
    const { result } = renderHook(() => useUpdateUser({ onFail }), { wrapper });
    await act(() => result.current.run(user, { password: GENERIC_PASSWORD }));
    expect(back.lists()).toHaveLength(0);
    expect(onFail.mock.calls[0]?.[0].messages[0]).toMatch(
      /restableció la contraseña/,
    );
  });

  it('400 llega por campo', async () => {
    fakeUsersBack([user], {
      patch: {
        status: 400,
        message: ['El nombre del personal admite de 2 a 80 caracteres.'],
      },
    });
    const { wrapper } = setup();
    const onFail = vi.fn();
    const { result } = renderHook(() => useUpdateUser({ onFail }), { wrapper });
    await act(() => result.current.run(user, { fullName: 'N'.repeat(90) }));
    expect(onFail.mock.calls[0]?.[0].fields.fullName).toMatch(/2 a 80/);
  });
});

describe('useChangeRole', () => {
  let op = userFixture({ id: 'u-op' });
  beforeEach(() => {
    op = userFixture({ id: 'u-op' });
  });

  it('cambia el rol con un PATCH /role', async () => {
    const back = fakeUsersBack([op]);
    const { wrapper } = setup();
    const onDone = vi.fn();
    const { result } = renderHook(() => useChangeRole({ onDone }), { wrapper });
    await act(() => result.current.run(op, 'admin'));
    expect(back.patches()).toHaveLength(0);
    expect(back.roles()[0]?.body).toEqual({ role: 'admin' });
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'admin' }),
      'sent',
    );
  });

  it('a repartidor guarda primero nombre y celular y luego cambia el rol', async () => {
    const back = fakeUsersBack([op]);
    const { wrapper } = setup();
    const { result } = renderHook(() => useChangeRole(), { wrapper });
    await act(() =>
      result.current.run(op, 'repartidor', {
        fullName: 'Rep',
        phone: '311 222 3344',
      }),
    );
    expect(back.patches()[0]?.body).toEqual({
      fullName: 'Rep',
      phone: '311 222 3344',
    });
    expect(back.roles()).toHaveLength(1);
    expect(back.calls.map((c) => c.url)).toEqual([
      '/api/users/u-op',
      '/api/users/u-op/role',
    ]);
  });

  it('409 (cliente, último admin, propio rol) se entrega con el texto del back', async () => {
    fakeUsersBack([op], {
      role: { status: 409, message: 'No puedes cambiar tu propio rol.' },
    });
    const { wrapper } = setup();
    const onFail = vi.fn();
    const { result } = renderHook(() => useChangeRole({ onFail }), { wrapper });
    await act(() => result.current.run(op, 'admin'));
    expect(onFail).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'conflict',
        messages: ['No puedes cambiar tu propio rol.'],
      }),
    );
  });

  it('corte con el rol ya cambiado se da por hecho', async () => {
    fakeUsersBack([op], { role: 'network-saved' });
    const { wrapper } = setup();
    const onDone = vi.fn();
    const { result } = renderHook(() => useChangeRole({ onDone }), { wrapper });
    await act(() => result.current.run(op, 'admin'));
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ role: 'admin' }),
      'recovered',
    );
  });

  it('el mismo rol no envía nada', async () => {
    const back = fakeUsersBack([op]);
    const { wrapper } = setup();
    const { result } = renderHook(() => useChangeRole(), { wrapper });
    await act(() => result.current.run(op, 'operador'));
    expect(back.calls).toHaveLength(0);
  });
});

describe('useDeleteUser', () => {
  const op = userFixture({ id: 'u-op' });

  it('elimina con un DELETE y evita el doble clic', async () => {
    const back = fakeUsersBack([op]);
    const { wrapper } = setup();
    const onDone = vi.fn();
    const { result } = renderHook(() => useDeleteUser({ onDone }), { wrapper });
    await act(async () => {
      void result.current.run(op);
      void result.current.run(op);
    });
    expect(back.deletes()).toHaveLength(1);
    expect(onDone).toHaveBeenCalledWith('sent');
  });

  it('409 de historial llega con el texto del back', async () => {
    fakeUsersBack([op], {
      del: {
        status: 409,
        message: 'El usuario tiene historial asociado; no se puede eliminar.',
      },
    });
    const { wrapper } = setup();
    const onFail = vi.fn();
    const { result } = renderHook(() => useDeleteUser({ onFail }), { wrapper });
    await act(() => result.current.run(op));
    expect(onFail.mock.calls[0]?.[0]).toMatchObject({
      kind: 'conflict',
      messages: ['El usuario tiene historial asociado; no se puede eliminar.'],
    });
  });

  it('corte con el usuario ya eliminado se da por eliminado; si sigue, falla', async () => {
    const saved = fakeUsersBack([op], { del: 'network-saved' });
    const first = setup();
    const onDone = vi.fn();
    const a = renderHook(() => useDeleteUser({ onDone }), {
      wrapper: first.wrapper,
    });
    await act(() => a.result.current.run(op));
    expect(saved.deletes()).toHaveLength(1);
    expect(onDone).toHaveBeenCalledWith('recovered');

    fakeUsersBack([op], { del: 'network' });
    const second = setup();
    const onFail = vi.fn();
    const b = renderHook(() => useDeleteUser({ onFail }), {
      wrapper: second.wrapper,
    });
    await act(() => b.result.current.run(op));
    expect(onFail).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'ambiguous' }),
    );
  });
});
