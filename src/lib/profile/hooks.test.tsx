import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeProfileBack, profileFixture } from '../../../tests/utils/profile';
import { PROFILE_KEY } from './use-profile';
import { useChangePassword } from './use-change-password';
import { useUpdateProfile } from './use-update-profile';

afterEach(() => vi.unstubAllGlobals());

const original = { fullName: 'Ana Pérez', phone: '+573001234567' };

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(PROFILE_KEY, profileFixture());
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe('useUpdateProfile', () => {
  it('envía solo los campos que cambiaron y actualiza la caché del perfil', async () => {
    const back = fakeProfileBack();
    const { client, wrapper } = setup();
    const onDone = vi.fn();
    const { result } = renderHook(() => useUpdateProfile({ onDone }), {
      wrapper,
    });
    await act(() =>
      result.current.run(original, {
        fullName: ' Ana M. ',
        phone: original.phone,
      }),
    );
    expect(back.patches()).toHaveLength(1);
    expect(back.patches()[0]?.body).toEqual({ fullName: 'Ana M.' });
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ fullName: 'Ana M.' }),
      'sent',
    );
    expect(
      client.getQueryData<{ fullName: string }>(PROFILE_KEY)?.fullName,
    ).toBe('Ana M.');
  });

  it('sin cambios no envía nada; el doble clic envía una sola vez', async () => {
    const back = fakeProfileBack();
    const { wrapper } = setup();
    const { result } = renderHook(() => useUpdateProfile(), { wrapper });
    await act(() => result.current.run(original, original));
    expect(back.patches()).toHaveLength(0);
    await act(async () => {
      void result.current.run(original, { ...original, fullName: 'Otra' });
      void result.current.run(original, { ...original, fullName: 'Otra' });
    });
    expect(back.patches()).toHaveLength(1);
  });

  it('400 del back llega por campo', async () => {
    fakeProfileBack(profileFixture(), {
      patch: {
        status: 400,
        message: [
          'phone debe ser un celular colombiano o un número internacional válido.',
        ],
      },
    });
    const { wrapper } = setup();
    const onFail = vi.fn();
    const { result } = renderHook(() => useUpdateProfile({ onFail }), {
      wrapper,
    });
    await act(() => result.current.run(original, { ...original, phone: '12' }));
    expect(onFail).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: 'validation',
        fields: { phone: expect.stringMatching(/celular colombiano/) },
      }),
    );
  });

  it('corte de red con el cambio ya guardado: lo encuentra al consultar el perfil', async () => {
    const back = fakeProfileBack(profileFixture(), { patch: 'network-saved' });
    const { wrapper } = setup();
    const onDone = vi.fn();
    const onFail = vi.fn();
    const { result } = renderHook(() => useUpdateProfile({ onDone, onFail }), {
      wrapper,
    });
    await act(() =>
      result.current.run(original, { ...original, phone: '300 765 4322' }),
    );
    expect(onFail).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ phone: '+573007654322' }),
      'recovered',
    );
    expect(back.patches()).toHaveLength(1);
  });

  it('corte de red sin guardar: no reintenta solo y avisa', async () => {
    const back = fakeProfileBack(profileFixture(), { patch: 'network' });
    const { wrapper } = setup();
    const onFail = vi.fn();
    const { result } = renderHook(() => useUpdateProfile({ onFail }), {
      wrapper,
    });
    await act(() =>
      result.current.run(original, { ...original, fullName: 'Otra Persona' }),
    );
    expect(onFail).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'ambiguous' }),
    );
    expect(back.patches()).toHaveLength(1);
  });
});

describe('useChangePassword', () => {
  it('envía las dos contraseñas una sola vez y termina en 204', async () => {
    const back = fakeProfileBack();
    const { wrapper } = setup();
    const onDone = vi.fn();
    const { result } = renderHook(() => useChangePassword({ onDone }), {
      wrapper,
    });
    await act(async () => {
      void result.current.run('Password-123456', 'Otra-Clave-98765');
      void result.current.run('Password-123456', 'Otra-Clave-98765');
    });
    expect(back.passwords()).toHaveLength(1);
    expect(back.passwords()[0]?.body).toEqual({
      currentPassword: 'Password-123456',
      newPassword: 'Otra-Clave-98765',
    });
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('403 es contraseña actual incorrecta (no cierra la sesión) y no se reintenta', async () => {
    const back = fakeProfileBack(profileFixture(), {
      password: {
        status: 403,
        message: 'La contraseña actual no es correcta.',
      },
    });
    const { wrapper } = setup();
    const onFail = vi.fn();
    const { result } = renderHook(() => useChangePassword({ onFail }), {
      wrapper,
    });
    await act(() => result.current.run('Incorrecta-12345', 'Otra-Clave-98765'));
    expect(onFail).toHaveBeenCalledWith({
      kind: 'current',
      messages: ['La contraseña actual no es correcta.'],
    });
    expect(back.passwords()).toHaveLength(1);
  });

  it('corte de red: aviso con las dos posibilidades, sin reintento', async () => {
    const back = fakeProfileBack(profileFixture(), { password: 'network' });
    const { wrapper } = setup();
    const onFail = vi.fn();
    const { result } = renderHook(() => useChangePassword({ onFail }), {
      wrapper,
    });
    await act(() => result.current.run('Password-123456', 'Otra-Clave-98765'));
    expect(onFail).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'ambiguous' }),
    );
    expect(back.passwords()).toHaveLength(1);
  });
});
