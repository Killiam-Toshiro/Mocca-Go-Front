// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  MOCK_PASSWORD,
  startMockApi,
  type MockApi,
} from '../../../tests/mock-api/server.mts';
import {
  forward,
  matchRoute,
  normalizeApiPath,
  type ForwardOptions,
} from './forward';

let mock: MockApi;
beforeAll(async () => {
  mock = await startMockApi();
});
afterAll(async () => {
  await mock.close();
});
beforeEach(() => mock.reset());

function env(
  overrides: Partial<ForwardOptions['env']> = {},
): ForwardOptions['env'] {
  return {
    API_URL: mock.url,
    TRUST_PROXY_HOPS: 0,
    COOKIE_SECURE: false,
    ...overrides,
  };
}

function req(path: string, init: RequestInit = {}): Request {
  return new Request(`http://localhost:3001${path}`, init);
}

async function loginToken(username = 'admin'): Promise<string> {
  const response = await fetch(`${mock.url}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: MOCK_PASSWORD }),
  });
  const body = (await response.json()) as { accessToken: string };
  mock.requests.length = 0;
  return body.accessToken;
}

describe('normalizeApiPath', () => {
  it('devuelve la ruta del contrato sin /api', () => {
    expect(normalizeApiPath('/api/users/abc-123')).toEqual({
      ok: true,
      path: '/users/abc-123',
    });
  });

  it.each([
    '/api/users/../admin',
    '/api/users/./x',
    '/api/users//x',
    '/api//users',
    '/api/users/',
    '/api/users%2Fx',
    '/api/users%2fx',
    '/api/%2e%2e/users',
    '/api/users/%5cx',
    '/api/users\\x',
    '/api/users/a%00b',
    '/api/users/a b',
    '/api/',
    '/otra/ruta',
    '/apix/users',
  ])('rechaza %j', (path) => {
    expect(normalizeApiPath(path)).toEqual({ ok: false });
  });
});

describe('matchRoute', () => {
  it('encuentra rutas con parámetros', () => {
    expect(matchRoute('PATCH', '/users/abc/role')).toMatchObject({
      pattern: '/users/{id}/role',
    });
  });

  it('la ruta literal gana a la que tiene parámetro', () => {
    expect(matchRoute('GET', '/orders/stream')).toMatchObject({
      pattern: '/orders/stream',
      stream: true,
    });
    expect(matchRoute('GET', '/orders/123')).toMatchObject({
      pattern: '/orders/{id}',
      stream: false,
    });
  });

  it('el método importa', () => {
    expect(matchRoute('DELETE', '/menu')).toBeNull();
    expect(matchRoute('TRACE', '/menu')).toBeNull();
    expect(matchRoute('get', '/menu')).not.toBeNull();
  });

  it('rutas desconocidas, con prefijo /api/v1 o con más segmentos no existen', () => {
    expect(matchRoute('GET', '/secreto')).toBeNull();
    expect(matchRoute('GET', '/api/v1/menu')).toBeNull();
    expect(matchRoute('GET', '/menu/extra')).toBeNull();
  });

  it('login y logout no se reenvían por la pasarela', () => {
    expect(matchRoute('POST', '/auth/login')).toBeNull();
    expect(matchRoute('POST', '/auth/logout')).toBeNull();
    expect(matchRoute('GET', '/auth/me')).not.toBeNull();
  });
});

describe('forward: acceso', () => {
  it('ruta o método fuera de la tabla → 404 sin llamar al back', async () => {
    const cases = [
      ['GET', '/api/secreto'],
      ['DELETE', '/api/menu'],
      ['POST', '/api/auth/login'],
    ] as const;
    for (const [method, path] of cases) {
      const response = await forward(req(path, { method }), { env: env() });
      expect(response.status).toBe(404);
    }
    expect(mock.requests).toHaveLength(0);
  });

  it('rutas con caracteres peligrosos → 400 sin llamar al back', async () => {
    const response = await forward(req('/api/users%2F..%2Fadmin'), {
      env: env(),
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      statusCode: 400,
      message: 'Ruta no válida.',
      error: 'Bad Request',
    });
    expect(mock.requests).toHaveLength(0);
  });

  it('ruta privada sin cookie → 401 local sin llamar al back', async () => {
    const response = await forward(req('/api/users'), { env: env() });
    expect(response.status).toBe(401);
    expect(await response.json()).toMatchObject({
      statusCode: 401,
      error: 'Unauthorized',
    });
    expect(mock.requests).toHaveLength(0);
  });

  it('ruta pública sin cookie → pasa al back', async () => {
    const response = await forward(req('/api/menu'), { env: env() });
    expect(response.status).toBe(200);
    expect(mock.requests).toHaveLength(1);
  });
});

describe('forward: cabeceras', () => {
  it('añade Authorization desde la cookie y no reenvía la cookie ni otras cabeceras', async () => {
    const token = await loginToken();

    const response = await forward(
      req('/api/users', {
        headers: {
          cookie: `session=${token}; session_exp=123; otra=1`,
          origin: 'http://localhost:3001',
          referer: 'http://localhost:3001/admin',
          'x-evil': '1',
          'x-real-ip': '6.6.6.6',
          'x-forwarded-host': 'evil.test',
          accept: 'application/json',
        },
      }),
      { env: env() },
    );

    expect(response.status).toBe(200);
    const seen = mock.requests[0]!.headers;
    expect(seen.authorization).toBe(`Bearer ${token}`);
    expect(seen.accept).toBe('application/json');
    for (const name of [
      'cookie',
      'origin',
      'referer',
      'x-evil',
      'x-real-ip',
      'x-forwarded-host',
    ]) {
      expect(seen[name]).toBeUndefined();
    }
  });

  it('con cookies Secure solo vale __Host-session', async () => {
    const token = await loginToken();
    const secure = env({ COOKIE_SECURE: true });
    const ok = await forward(
      req('/api/users', { headers: { cookie: `__Host-session=${token}` } }),
      {
        env: secure,
      },
    );
    expect(ok.status).toBe(200);
    const plain = await forward(
      req('/api/users', { headers: { cookie: `session=${token}` } }),
      {
        env: secure,
      },
    );
    expect(plain.status).toBe(401);
  });

  it('en rutas públicas no envía el token aunque haya cookie', async () => {
    const token = await loginToken();
    await forward(
      req('/api/menu', { headers: { cookie: `session=${token}` } }),
      { env: env() },
    );
    expect(mock.requests[0]!.headers.authorization).toBeUndefined();
  });

  it('reenvía el cuerpo y las cabeceras permitidas (Idempotency-Key, Content-Type)', async () => {
    const body = JSON.stringify({
      email: 'nuevo@example.com',
      password: MOCK_PASSWORD,
      fullName: 'Nuevo Cliente',
      phone: '3001234567',
    });
    const response = await forward(
      req('/api/customers', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'idempotency-key': 'abc-1',
        },
        body,
      }),
      { env: env() },
    );
    expect(response.status).toBe(201);
    const seen = mock.requests[0]!;
    expect(seen.body).toBe(body);
    expect(seen.headers['idempotency-key']).toBe('abc-1');
    expect(seen.headers['content-type']).toBe('application/json');
  });

  it('reenvía la consulta (query string)', async () => {
    const token = await loginToken();
    await forward(
      req('/api/users?page=2&q=ana', {
        headers: { cookie: `session=${token}` },
      }),
      {
        env: env(),
      },
    );
    expect(mock.requests[0]!.query).toBe('?page=2&q=ana');
  });
});

describe('forward: IP del cliente (CA-24)', () => {
  const sent = () => mock.requests.at(-1)!.headers['x-forwarded-for'];

  it('con 1 salto envía solo la última IP: la que añadió el proxy', async () => {
    await forward(
      req('/api/menu', { headers: { 'x-forwarded-for': '1.2.3.4, 9.9.9.9' } }),
      {
        env: env({ TRUST_PROXY_HOPS: 1 }),
      },
    );
    expect(sent()).toBe('9.9.9.9');
  });

  it.each([
    ['0 saltos', { 'x-forwarded-for': '9.9.9.9' }, 0],
    ['sin cabecera', {}, 1],
    ['valor que no es IP', { 'x-forwarded-for': 'abc' }, 1],
  ])('no envía X-Forwarded-For: %s', async (_motivo, headers, hops) => {
    await forward(req('/api/menu', { headers }), {
      env: env({ TRUST_PROXY_HOPS: hops }),
    });
    expect(sent()).toBeUndefined();
  });
});

describe('forward: respuestas del back', () => {
  it('reenvía estado y mensaje (409 en registro)', async () => {
    const response = await forward(
      req('/api/customers', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'ocupado@example.com',
          password: MOCK_PASSWORD,
          fullName: 'Otro Cliente',
          phone: '3001234567',
        }),
      }),
      { env: env() },
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({
      message: 'El correo ya está registrado',
    });
  });

  it('las respuestas privadas llevan no-store y no filtran cabeceras del back', async () => {
    const token = await loginToken();
    const response = await forward(
      req('/api/users', { headers: { cookie: `session=${token}` } }),
      { env: env() },
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-powered-by')).toBeNull();
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('401 del back en ruta privada → borra las cookies', async () => {
    const token = await loginToken();
    mock.revokeAllSessions();
    const response = await forward(
      req('/api/users', { headers: { cookie: `session=${token}` } }),
      { env: env() },
    );
    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie()).toEqual([
      'session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax',
      'session_exp=; Max-Age=0; Path=/; SameSite=Lax',
    ]);
  });

  it('403 del back no borra las cookies', async () => {
    const token = await loginToken('operador');
    const response = await forward(
      req('/api/users', { headers: { cookie: `session=${token}` } }),
      { env: env() },
    );
    expect(response.status).toBe(403);
    expect(response.headers.getSetCookie()).toEqual([]);
  });
});

describe('forward: fallos de conexión', () => {
  it('back apagado → 502 en el formato estándar', async () => {
    const response = await forward(req('/api/menu'), {
      env: env({ API_URL: 'http://127.0.0.1:1/api/v1' }),
    });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      statusCode: 502,
      message: 'No pudimos conectar con el servidor.',
      error: 'Bad Gateway',
    });
  });

  it('tiempo agotado → 504', async () => {
    mock.behavior.menuDelayMs = 400;
    const response = await forward(req('/api/menu'), {
      env: env(),
      timeoutMs: 60,
    });
    expect(response.status).toBe(504);
    expect(await response.json()).toMatchObject({
      statusCode: 504,
      error: 'Gateway Timeout',
    });
  });

  it('una redirección del back se trata como 502, no se sigue', async () => {
    const fake = (async () =>
      new Response(null, {
        status: 302,
        headers: { location: 'http://evil.test' },
      })) as typeof fetch;
    const response = await forward(req('/api/menu'), {
      env: env(),
      fetch: fake,
    });
    expect(response.status).toBe(502);
    expect(response.headers.get('location')).toBeNull();
  });
});

describe('forward: flujo (CA-18)', () => {
  it('entrega el primer fragmento antes de que el back termine', async () => {
    const token = await loginToken();
    mock.behavior.streamMode = 'legacy';
    mock.behavior.streamGapMs = 200;

    const response = await forward(
      req('/api/orders/stream', { headers: { cookie: `session=${token}` } }),
      { env: env() },
    );
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/event-stream');
    expect(response.headers.get('x-accel-buffering')).toBe('no');

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const first = await reader.read();
    expect(decoder.decode(first.value)).toContain('data: 1');
    expect(mock.streamsFinished).toBe(0);

    let rest = '';
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      rest += decoder.decode(value);
    }
    expect(rest).toContain('data: 2');
    expect(rest).toContain('data: 3');
    expect(mock.streamsFinished).toBe(1);
  });

  it('si el navegador cierra la conexión, se corta la llamada al back', async () => {
    const token = await loginToken();
    const controller = new AbortController();
    mock.behavior.streamMode = 'legacy';
    mock.behavior.streamGapMs = 100;

    const response = await forward(
      req('/api/orders/stream', {
        headers: { cookie: `session=${token}` },
        signal: controller.signal,
      }),
      { env: env() },
    );
    const reader = response.body!.getReader();
    await reader.read();
    controller.abort();
    await expect(reader.read()).rejects.toThrow();
  });
});
