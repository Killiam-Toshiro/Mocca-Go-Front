import { nextDelay } from './backoff';
import { createSseParser, type SseMessage } from './parser';

export type SseState = 'connecting' | 'live' | 'reconnecting' | 'stopped';

export const SILENCE_MS = 60_000;
export const RATE_LIMIT_WAIT_MS = 60_000;

export interface SseOptions {
  url: string;
  onMessage: (message: SseMessage) => void;
  onState?: (state: SseState) => void;
  /** 401: la sesión terminó; el canal no se reintenta. */
  onUnauthorized?: () => void;
  fetchFn?: typeof fetch;
  random?: () => number;
  /** Sin recibir nada durante este tiempo se cierra y se reconecta (el back manda un latido cada 25 s). */
  silenceMs?: number;
  /** Espera tras un 429. */
  rateLimitMs?: number;
}

type Outcome = 'ended' | 'error' | 'rate' | 'unauthorized' | 'forbidden';

/**
 * Canal SSE sobre `fetch` (la cookie de sesión viaja sola y se conoce el código HTTP).
 * Reconecta con espera creciente; el evento `ready` marca el canal como `live`.
 */
export function openSseChannel(options: SseOptions): { close: () => void } {
  const fetchFn = options.fetchFn ?? ((...args) => fetch(...args));
  const silenceMs = options.silenceMs ?? SILENCE_MS;
  const rateLimitMs = options.rateLimitMs ?? RATE_LIMIT_WAIT_MS;

  let closed = false;
  let attempt = 0;
  let state: SseState | undefined;
  let controller: AbortController | undefined;
  let sleepTimer: ReturnType<typeof setTimeout> | undefined;
  let wake: (() => void) | undefined;

  function setState(next: SseState): void {
    if (state === next) return;
    state = next;
    options.onState?.(next);
  }

  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
      wake = resolve;
      sleepTimer = setTimeout(resolve, ms);
    });
  }

  async function connectOnce(): Promise<Outcome> {
    const ctrl = new AbortController();
    controller = ctrl;
    let watchdog: ReturnType<typeof setTimeout> | undefined;
    const arm = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(() => ctrl.abort(), silenceMs);
    };
    try {
      arm();
      const response = await fetchFn(options.url, {
        method: 'GET',
        headers: { accept: 'text/event-stream' },
        cache: 'no-store',
        credentials: 'same-origin',
        signal: ctrl.signal,
      });
      if (response.status === 401) return 'unauthorized';
      if (response.status === 403) return 'forbidden';
      if (response.status === 429) return 'rate';
      if (!response.ok || !response.body) return 'error';

      const parser = createSseParser((message) => {
        if (message.event === 'ready') {
          attempt = 0;
          setState('live');
        }
        try {
          options.onMessage(message);
        } catch {
          // Un error del consumidor no debe tumbar el canal.
        }
      });
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      for (;;) {
        const { done, value } = await reader.read();
        if (done) return 'ended';
        arm();
        parser.feed(decoder.decode(value, { stream: true }));
      }
    } catch {
      return 'error';
    } finally {
      clearTimeout(watchdog);
      ctrl.abort();
    }
  }

  async function run(): Promise<void> {
    setState('connecting');
    while (!closed) {
      const outcome = await connectOnce();
      if (closed) return;
      if (outcome === 'unauthorized') {
        setState('stopped');
        options.onUnauthorized?.();
        return;
      }
      if (outcome === 'forbidden') {
        setState('stopped');
        return;
      }
      setState('reconnecting');
      await sleep(
        outcome === 'rate' ? rateLimitMs : nextDelay(attempt++, options.random),
      );
    }
  }

  void run();

  return {
    close() {
      if (closed) return;
      closed = true;
      controller?.abort();
      clearTimeout(sleepTimer);
      wake?.();
    },
  };
}
