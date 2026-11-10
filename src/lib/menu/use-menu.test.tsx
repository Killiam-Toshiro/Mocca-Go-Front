import { waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { jsonResponse } from '../../../tests/utils/render';
import { useMenu } from './use-menu';

afterEach(() => vi.unstubAllGlobals());

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, retryDelay: 0 } },
  });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useMenu', () => {
  it('pide /api/menu por GET y devuelve la lista', async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse({ data: [{ id: 'a', name: 'Capuchino' }] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { result } = renderHook(() => useMenu(), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([{ id: 'a', name: 'Capuchino' }]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/api/menu');
    expect(init.method).toBe('GET');
  });

  it.each([429, 502, 504])('un %i queda como error', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ statusCode: status, message: 'x' }, status),
      ),
    );
    const { result } = renderHook(() => useMenu(), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.data).toBeUndefined();
  });
});
