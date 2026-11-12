import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../../tests/utils/render';
import {
  ROUNDS_POLL_MS,
  staffRoundsUrl,
  useStaffRounds,
} from './use-staff-rounds';

const EMPTY = { page: 1, limit: 20, total: 0, totalPages: 1, data: [] };

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { wrapper };
}

function setVisibility(state: 'visible' | 'hidden') {
  Object.defineProperty(document, 'visibilityState', {
    configurable: true,
    get: () => state,
  });
  document.dispatchEvent(new Event('visibilitychange'));
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  setVisibility('visible');
});

describe('rondas del personal', () => {
  it('arma la URL con el estado solo si se filtra', () => {
    expect(staffRoundsUrl(1, 'todas')).toBe(
      '/api/dispatch/rounds?page=1&limit=20',
    );
    expect(staffRoundsUrl(2, 'activa')).toBe(
      '/api/dispatch/rounds?page=2&limit=20&status=activa',
    );
  });

  it('sondea cada 15 s con la pestaña visible y no consulta con la pestaña oculta (D-122)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const f = vi.fn<typeof fetch>(async () => jsonResponse(EMPTY));
    vi.stubGlobal('fetch', f);
    const { wrapper } = setup();
    const { result } = renderHook(() => useStaffRounds(1, 'todas'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(f).toHaveBeenCalledTimes(1);

    await act(() => vi.advanceTimersByTimeAsync(ROUNDS_POLL_MS + 100));
    expect(f).toHaveBeenCalledTimes(2);

    act(() => setVisibility('hidden'));
    await act(() => vi.advanceTimersByTimeAsync(ROUNDS_POLL_MS * 4));
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('deja de consultar al desmontar', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const f = vi.fn<typeof fetch>(async () => jsonResponse(EMPTY));
    vi.stubGlobal('fetch', f);
    const { wrapper } = setup();
    const { result, unmount } = renderHook(() => useStaffRounds(1, 'todas'), {
      wrapper,
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    unmount();
    await act(() => vi.advanceTimersByTimeAsync(ROUNDS_POLL_MS * 3));
    expect(f).toHaveBeenCalledTimes(1);
  });
});
