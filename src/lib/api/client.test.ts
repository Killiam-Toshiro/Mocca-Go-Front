import { describe, expect, it, vi } from 'vitest';
import { createApiClient, unwrap } from './client';

function setup() {
  const requests: Request[] = [];
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    requests.push(input as Request);
    return new Response('{}', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  // Las rutas relativas (`/api`) no se resuelven en Node; en el navegador sí.
  const client = createApiClient({
    baseUrl: 'http://localhost/api',
    fetch: fetchMock,
  });
  const lastPath = () => new URL((requests.at(-1) as Request).url).pathname;
  return { client, lastPath };
}

describe('createApiClient', () => {
  it('llama bajo /api, sin el prefijo /api/v1', async () => {
    const { client, lastPath } = setup();
    await client.GET('/menu');
    expect(lastPath()).toBe('/api/menu');
  });

  it('el tipo no admite rutas con el prefijo /api/v1', async () => {
    const { client } = setup();
    // @ts-expect-error la ruta correcta es '/menu'
    await client.GET('/api/v1/menu');
  });

  it('sustituye los parámetros de ruta', async () => {
    const { client, lastPath } = setup();
    await client.GET('/users/{id}', { params: { path: { id: 'abc' } } });
    expect(lastPath()).toBe('/api/users/abc');
  });
});

describe('onUnauthorized y unwrap', () => {
  const respond = (status: number, body: unknown = {}) =>
    vi.fn<typeof fetch>(
      async () =>
        new Response(status === 204 ? null : JSON.stringify(body), {
          status,
          headers: { 'content-type': 'application/json' },
        }),
    );

  it('un 401 avisa a quien escucha; otros estados no', async () => {
    const onUnauthorized = vi.fn();
    for (const status of [200, 403, 404, 500]) {
      const client = createApiClient({
        baseUrl: 'http://localhost/api',
        fetch: respond(status),
        onUnauthorized,
      });
      await client.GET('/menu');
    }
    expect(onUnauthorized).not.toHaveBeenCalled();

    const client = createApiClient({
      baseUrl: 'http://localhost/api',
      fetch: respond(401),
      onUnauthorized,
    });
    await client.GET('/users');
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('unwrap devuelve el dato', async () => {
    const client = createApiClient({
      baseUrl: 'http://localhost/api',
      fetch: respond(200, []),
    });
    expect(await unwrap(client.GET('/menu'))).toEqual([]);
  });

  it('unwrap lanza ApiError con el mensaje del servidor', async () => {
    const client = createApiClient({
      baseUrl: 'http://localhost/api',
      fetch: respond(403, { statusCode: 403, message: 'Forbidden resource' }),
    });
    await expect(unwrap(client.GET('/users'))).rejects.toMatchObject({
      status: 403,
      messages: ['Forbidden resource'],
    });
  });

  it('unwrap convierte un fallo de red en ApiError de conexión', async () => {
    const failing = vi.fn<typeof fetch>(async () =>
      Promise.reject(new TypeError('caído')),
    );
    const client = createApiClient({
      baseUrl: 'http://localhost/api',
      fetch: failing,
    });
    await expect(unwrap(client.GET('/menu'))).rejects.toMatchObject({
      status: 0,
      isUnreachable: true,
    });
  });
});
