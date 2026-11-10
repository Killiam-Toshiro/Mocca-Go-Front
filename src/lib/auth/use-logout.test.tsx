import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../../tests/utils/render';
import { useLogout } from './use-logout';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@/lib/browser', () => ({ navigate, currentPath: () => '/' }));

beforeEach(() => navigate.mockClear());
afterEach(() => vi.unstubAllGlobals());

function setup() {
  const client = new QueryClient();
  client.setQueryData(['privado'], { secreto: true });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, ...renderHook(() => useLogout(), { wrapper }) };
}

describe('useLogout', () => {
  it('llama a /api/auth/logout, vacía la caché y va a /login', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(null, 204));
    vi.stubGlobal('fetch', fetchMock);
    const { result, client } = setup();

    act(() => result.current.mutate());

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/login'));
    expect((fetchMock.mock.calls[0] as unknown as [string])[0]).toBe(
      '/api/auth/logout',
    );
    expect(client.getQueryData(['privado'])).toBeUndefined();
  });

  it('si el servidor falla, igual vacía la caché y va a /login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('sin red'))),
    );
    const { result, client } = setup();

    act(() => result.current.mutate());

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/login'));
    expect(client.getQueryData(['privado'])).toBeUndefined();
  });
});
