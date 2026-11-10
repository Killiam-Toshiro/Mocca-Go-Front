import { act, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '../../../tests/utils/render';
import { resetExpireGuard } from './query-provider';
import { SessionProvider, useSession } from './session-provider';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@/lib/browser', () => ({
  navigate,
  currentPath: () => '/admin/usuarios?p=2',
}));

const user = { id: '1', username: 'ana', role: 'admin' as const };

function Who() {
  const { user: u } = useSession();
  return <p>{u.username}</p>;
}

function clearCookie() {
  document.cookie = 'session_exp=; Max-Age=0; Path=/';
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
  resetExpireGuard();
  navigate.mockClear();
  clearCookie();
});
afterEach(() => {
  vi.useRealTimers();
  clearCookie();
});

const mount = (expiresAt: number | null) =>
  renderWithQuery(
    <SessionProvider user={user} expiresAt={expiresAt}>
      <Who />
    </SessionProvider>,
  );

describe('SessionProvider', () => {
  it('entrega el usuario a los hijos', () => {
    mount(null);
    expect(screen.getByText('ana')).toBeInTheDocument();
  });

  it('useSession fuera del proveedor falla con un mensaje claro', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderWithQuery(<Who />)).toThrow(/SessionProvider/);
    spy.mockRestore();
  });

  it('al vencer la sesión limpia la caché y pasa por /api/auth/expired con la ruta actual', () => {
    const { client } = mount(Date.now() + 5_000);
    client.setQueryData(['x'], 1);

    act(() => void vi.advanceTimersByTime(4_999));
    expect(navigate).not.toHaveBeenCalled();

    act(() => void vi.advanceTimersByTime(2));
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith(
      '/api/auth/expired?next=%2Fadmin%2Fusuarios%3Fp%3D2',
    );
    expect(client.getQueryData(['x'])).toBeUndefined();
  });

  it('si ya venció al montar, sale de inmediato', () => {
    mount(Date.now() - 1);
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('sin vencimiento conocido no programa nada', () => {
    mount(null);
    act(() => void vi.advanceTimersByTime(10 * 24 * 3600 * 1000));
    expect(navigate).not.toHaveBeenCalled();
  });

  it('la cookie session_exp manda sobre el valor del servidor (sesión renovada en otra pestaña)', () => {
    document.cookie = `session_exp=${Date.now() + 60_000}; Path=/`;
    mount(Date.now() + 5_000);
    act(() => void vi.advanceTimersByTime(10_000));
    expect(navigate).not.toHaveBeenCalled();
    act(() => void vi.advanceTimersByTime(60_000));
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('al volver a la pestaña revisa el vencimiento', () => {
    mount(Date.now() + 60_000);
    vi.setSystemTime(Date.now() + 120_000); // la pestaña estuvo suspendida
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(navigate).toHaveBeenCalledTimes(1);
  });

  it('redirige una sola vez aunque haya varios avisos', () => {
    mount(Date.now() - 1);
    act(() => void document.dispatchEvent(new Event('visibilitychange')));
    expect(navigate).toHaveBeenCalledTimes(1);
  });
});
