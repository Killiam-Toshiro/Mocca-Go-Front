import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse } from '../../../tests/utils/render';
import { ApiError } from './errors';
import { requestJson } from './json';

afterEach(() => vi.unstubAllGlobals());

describe('requestJson', () => {
  it('envía JSON al mismo origen y devuelve el cuerpo', async () => {
    const fetchMock = vi.fn(async () => jsonResponse({ ok: true }));
    vi.stubGlobal('fetch', fetchMock);

    const result = await requestJson<{ ok: boolean }>('/api/auth/login', {
      body: { a: 1 },
    });

    expect(result).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe('/api/auth/login');
    expect(init).toMatchObject({
      method: 'POST',
      credentials: 'same-origin',
      body: '{"a":1}',
    });
    expect(init.headers).toMatchObject({ 'content-type': 'application/json' });
  });

  it('sin cuerpo no envía Content-Type y acepta 204', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(null, 204));
    vi.stubGlobal('fetch', fetchMock);
    expect(await requestJson('/api/auth/logout')).toBeUndefined();
    const init = (
      fetchMock.mock.calls[0] as unknown as [string, RequestInit]
    )[1];
    expect(init.headers).not.toHaveProperty('content-type');
  });

  it('un error del servidor se convierte en ApiError con su mensaje', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse({ statusCode: 409, message: 'Repetido' }, 409),
      ),
    );
    await expect(requestJson('/x', { body: {} })).rejects.toMatchObject({
      status: 409,
      messages: ['Repetido'],
    });
  });

  it('una respuesta que no es JSON da el mensaje genérico', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('<html>', { status: 502 })),
    );
    const error = await requestJson('/x', { body: {} }).catch(
      (e: unknown) => e,
    );
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).isUnreachable).toBe(true);
  });

  it('sin red lanza un ApiError de conexión', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Promise.reject(new TypeError('fallo'))),
    );
    await expect(requestJson('/x', { body: {} })).rejects.toMatchObject({
      status: 0,
    });
  });
});
