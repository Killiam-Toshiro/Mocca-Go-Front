import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDebouncedValue } from './use-debounced-value';

afterEach(() => vi.useRealTimers());

describe('useDebouncedValue', () => {
  it('espera 400 ms sin cambios antes de entregar el valor', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v), {
      initialProps: { v: '' },
    });
    rerender({ v: 'a' });
    rerender({ v: 'an' });
    act(() => vi.advanceTimersByTime(399));
    expect(result.current).toBe('');
    act(() => vi.advanceTimersByTime(1));
    expect(result.current).toBe('an');
  });
});
