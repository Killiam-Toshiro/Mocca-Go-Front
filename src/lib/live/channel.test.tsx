import { act, render } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { openSseChannel, SseOptions } from '@/lib/sse/client';
import { renderWithQuery } from '../../../tests/utils/render';
import { LiveChannelProvider, useLiveStatus } from './channel';

const KEYS = [['kitchen']] as const;

function Status() {
  return <p>estado: {useLiveStatus()}</p>;
}

function fakeOpen() {
  const calls: SseOptions[] = [];
  const open = vi.fn((options: SseOptions) => {
    calls.push(options);
    return { close: vi.fn() };
  });
  return { open: open as unknown as typeof openSseChannel, calls };
}

describe('LiveChannelProvider', () => {
  it('abre la URL indicada y vuelve a consultar solo las claves indicadas', () => {
    const { open, calls } = fakeOpen();
    const { client, getByText } = renderWithQuery(
      <LiveChannelProvider
        url="/api/kitchen/stream"
        invalidate={KEYS}
        open={open}
      >
        <Status />
      </LiveChannelProvider>,
    );
    expect(calls[0]?.url).toBe('/api/kitchen/stream');
    expect(getByText('estado: off')).toBeInTheDocument();
    act(() => calls[0]!.onState!('live'));
    expect(getByText('estado: live')).toBeInTheDocument();

    const spy = vi.spyOn(client, 'invalidateQueries');
    calls[0]!.onMessage({ event: 'order', data: '{}' });
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith({ queryKey: ['kitchen'] });
    spy.mockClear();
    calls[0]!.onMessage({ event: 'otro', data: '' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('sin proveedor, el estado es «off»', () => {
    const { getByText } = render(<Status />);
    expect(getByText('estado: off')).toBeInTheDocument();
  });
});
