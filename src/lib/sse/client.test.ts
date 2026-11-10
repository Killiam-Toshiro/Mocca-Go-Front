import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openSseChannel, type SseState } from './client';
import type { SseMessage } from './parser';

const encoder = new TextEncoder();

/** Respuesta falsa cuyo flujo se controla a mano. */
function fakeStream(status = 200) {
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const body = new ReadableStream<Uint8Array>({
    start(c) {
      controller = c;
    },
  });
  return {
    response: { status, ok: status >= 200 && status < 300, body } as Response,
    push: (text: string) => controller.enqueue(encoder.encode(text)),
    end: () => controller.close(),
  };
}

function setup(responses: ReturnType<typeof fakeStream>[]) {
  const queue = [...responses];
  const fetchFn = vi.fn((_url: string | URL | Request, init?: RequestInit) => {
    const next = queue.shift();
    if (!next) return Promise.reject(new Error('sin respuesta'));
    init?.signal?.addEventListener('abort', () => {
      try {
        next.end();
      } catch {
        // ya cerrado
      }
    });
    return Promise.resolve(next.response);
  });
  const messages: SseMessage[] = [];
  const states: SseState[] = [];
  const onUnauthorized = vi.fn();
  const channel = openSseChannel({
    url: '/api/orders/stream',
    fetchFn: fetchFn as unknown as typeof fetch,
    onMessage: (m) => messages.push(m),
    onState: (s) => states.push(s),
    onUnauthorized,
    random: () => 0.5,
  });
  return { channel, fetchFn, messages, states, onUnauthorized };
}

const tick = (ms = 0) => vi.advanceTimersByTimeAsync(ms);

describe('openSseChannel', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('pide el flujo con la cabecera correcta y pasa a «live» con `ready`', async () => {
    const s1 = fakeStream();
    const { channel, fetchFn, messages, states } = setup([s1]);
    await tick();
    expect(fetchFn).toHaveBeenCalledTimes(1);
    const init = fetchFn.mock.calls[0]?.[1];
    expect(init?.headers).toEqual({ accept: 'text/event-stream' });
    expect(init?.cache).toBe('no-store');
    expect(states).toEqual(['connecting']);

    s1.push('event: ready\ndata: {}\n\n');
    await tick();
    s1.push('event: order\ndata: {"number":1001}\n\n');
    await tick();
    expect(states).toEqual(['connecting', 'live']);
    expect(messages.map((m) => m.event)).toEqual(['ready', 'order']);
    channel.close();
  });

  it('si el flujo termina reconecta con espera creciente y vuelve a «live»', async () => {
    const s1 = fakeStream();
    const s2 = fakeStream();
    const s3 = fakeStream();
    const { channel, fetchFn, states } = setup([s1, s2, s3]);
    await tick();
    s1.push('event: ready\ndata: 1\n\n');
    await tick();
    s1.end();
    await tick();
    expect(states.at(-1)).toBe('reconnecting');
    await tick(999);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);

    // el segundo intento cae sin `ready`: la espera crece (2 s)
    s2.end();
    await tick();
    await tick(1999);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    await tick(1);
    expect(fetchFn).toHaveBeenCalledTimes(3);

    s3.push('event: ready\ndata: 1\n\n');
    await tick();
    expect(states.at(-1)).toBe('live');
    channel.close();
  });

  it('`ready` reinicia la espera', async () => {
    const streams = [fakeStream(), fakeStream(), fakeStream(), fakeStream()];
    const { channel, fetchFn } = setup(streams);
    await tick();
    streams[0]?.end(); // sin ready → espera 1 s
    await tick(1000);
    streams[1]?.end(); // sin ready → espera 2 s
    await tick(2000);
    expect(fetchFn).toHaveBeenCalledTimes(3);
    streams[2]?.push('event: ready\ndata: 1\n\n');
    await tick();
    streams[2]?.end();
    await tick(1000); // vuelve a 1 s
    expect(fetchFn).toHaveBeenCalledTimes(4);
    channel.close();
  });

  it('un fallo de red reintenta', async () => {
    const { channel, fetchFn, states } = setup([]);
    await tick();
    expect(states).toEqual(['connecting', 'reconnecting']);
    await tick(1000);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    channel.close();
  });

  it('401: avisa y no reintenta', async () => {
    const { fetchFn, states, onUnauthorized } = setup([fakeStream(401)]);
    await tick();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(states.at(-1)).toBe('stopped');
    await tick(120_000);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('403: queda detenido sin reintentar ni avisar de sesión', async () => {
    const { fetchFn, states, onUnauthorized } = setup([fakeStream(403)]);
    await tick();
    expect(states.at(-1)).toBe('stopped');
    expect(onUnauthorized).not.toHaveBeenCalled();
    await tick(120_000);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('429: espera 60 s', async () => {
    const { channel, fetchFn, states } = setup([fakeStream(429), fakeStream()]);
    await tick();
    expect(states.at(-1)).toBe('reconnecting');
    await tick(59_999);
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await tick(1);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    channel.close();
  });

  it('un error 5xx reintenta con la espera creciente', async () => {
    const { channel, fetchFn } = setup([fakeStream(502), fakeStream()]);
    await tick();
    await tick(1000);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    channel.close();
  });

  it('60 s sin recibir nada cierra y reconecta; un latido lo mantiene', async () => {
    const s1 = fakeStream();
    const s2 = fakeStream();
    const { channel, fetchFn } = setup([s1, s2]);
    await tick();
    s1.push('event: ready\ndata: 1\n\n');
    await tick();
    await tick(50_000);
    s1.push(': latido\n\n');
    await tick();
    await tick(50_000); // 100 s en total, pero con un latido a los 50 s
    expect(fetchFn).toHaveBeenCalledTimes(1);
    await tick(10_001); // 60 s desde el último latido
    await tick(1000);
    expect(fetchFn).toHaveBeenCalledTimes(2);
    channel.close();
  });

  it('close() aborta la petición y no reconecta', async () => {
    const s1 = fakeStream();
    const { channel, fetchFn } = setup([s1]);
    await tick();
    const signal = fetchFn.mock.calls[0]?.[1]?.signal;
    channel.close();
    await tick(120_000);
    expect(signal?.aborted).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('close() durante la espera cancela la reconexión', async () => {
    const { channel, fetchFn } = setup([fakeStream(502), fakeStream()]);
    await tick();
    channel.close();
    await tick(120_000);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('un error del consumidor no tumba el canal', async () => {
    const s1 = fakeStream();
    const fetchFn = vi.fn(() => Promise.resolve(s1.response));
    const seen: string[] = [];
    const channel = openSseChannel({
      url: '/x',
      fetchFn: fetchFn as unknown as typeof fetch,
      onMessage: (m) => {
        seen.push(m.event);
        throw new Error('boom');
      },
    });
    await tick();
    s1.push('event: order\ndata: x\n\n');
    await tick();
    s1.push('event: order\ndata: y\n\n');
    await tick();
    expect(seen).toEqual(['order', 'order']);
    channel.close();
  });
});
