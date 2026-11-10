// @vitest-environment node
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import {
  MOCK_PASSWORD,
  startMockApi,
  type MockApi,
} from '../../../../tests/mock-api/server.mts';

const env = vi.hoisted(() => ({
  API_URL: '',
  TRUST_PROXY_HOPS: 0,
  COOKIE_SECURE: false,
  ALLOWED_ORIGINS: [] as string[],
}));
vi.mock('@/lib/server/env', () => ({ getEnv: () => env }));

import { GET as expired } from './expired/route';
import { POST as login } from './login/route';
import { POST as logout } from './logout/route';
import { GET as session } from './session/route';

let mock: MockApi;
beforeAll(async () => {
  mock = await startMockApi();
});
afterAll(async () => {
  await mock.close();
});
beforeEach(() => {
  mock.reset();
  env.API_URL = mock.url;
  env.TRUST_PROXY_HOPS = 0;
  env.COOKIE_SECURE = false;
});

const HOST = 'localhost:3001';
const json = {
  host: HOST,
  origin: `http://${HOST}`,
  'content-type': 'application/json',
};

function postLogin(
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return login(
    new Request(`http://${HOST}/api/auth/login`, {
      method: 'POST',
      headers: { ...json, ...headers },
      body: JSON.stringify(body),
    }),
  );
}

function cookiesOf(response: Response): Record<string, string> {
  return Object.fromEntries(
    response.headers.getSetCookie().map((line) => {
      const [pair] = line.split(';');
      const index = pair!.indexOf('=');
      return [pair!.slice(0, index), pair!.slice(index + 1)];
    }),
  );
}

describe('POST /api/auth/login', () => {
  it('personal: fija las cookies y responde usuario y vencimiento, nunca el token', async () => {
    const before = Date.now();
    const response = await postLogin({
      username: 'admin',
      password: MOCK_PASSWORD,
    });
    expect(response.status).toBe(200);

    const text = await response.clone().text();
    const body = (await response.json()) as {
      user: unknown;
      expiresAt: number;
    };
    expect(body.user).toEqual({
      id: 'u-admin',
      username: 'admin',
      role: 'admin',
    });
    expect(body.expiresAt).toBeGreaterThanOrEqual(before + 900_000);
    expect(Object.keys(body).sort()).toEqual(['expiresAt', 'user']);

    const cookies = cookiesOf(response);
    const token = cookies.session!;
    expect(token).toMatch(/^mock-admin-/);
    expect(text).not.toContain(token); // CA-05: el token no viaja en el cuerpo
    expect(cookies.session_exp).toBe(String(body.expiresAt));

    const lines = response.headers.getSetCookie();
    expect(lines[0]).toMatch(
      /^session=.*; Max-Age=900; Path=\/; HttpOnly; SameSite=Lax$/,
    );
    expect(lines[1]).toMatch(
      /^session_exp=\d+; Max-Age=900; Path=\/; SameSite=Lax$/,
    );
    expect(response.headers.get('cache-control')).toBe('no-store');
    // El token tampoco aparece en ninguna otra cabecera.
    for (const [name, value] of response.headers) {
      if (name !== 'set-cookie') expect(value).not.toContain(token);
    }
  });

  it('con cookies Secure usa __Host- y Secure', async () => {
    env.COOKIE_SECURE = true;
    const response = await postLogin({
      username: 'operador',
      password: MOCK_PASSWORD,
    });
    const [first, second] = response.headers.getSetCookie();
    expect(first).toMatch(
      /^__Host-session=.*; Path=\/; HttpOnly; Secure; SameSite=Lax$/,
    );
    expect(second).toMatch(/^session_exp=\d+; .*; Secure; SameSite=Lax$/);
  });

  it('cliente: entra con correo y obtiene rol cliente (CA-06)', async () => {
    const response = await postLogin({
      email: 'cliente@example.com',
      password: MOCK_PASSWORD,
    });
    expect(response.status).toBe(200);
    expect(
      ((await response.json()) as { user: { role: string } }).user.role,
    ).toBe('cliente');
    expect(JSON.parse(mock.requests[0]!.body)).toEqual({
      email: 'cliente@example.com',
      password: MOCK_PASSWORD,
    });
  });

  it('solo reenvía username, email y password', async () => {
    await postLogin({
      username: 'admin',
      password: MOCK_PASSWORD,
      role: 'admin',
      isAdmin: true,
    });
    expect(JSON.parse(mock.requests[0]!.body)).toEqual({
      username: 'admin',
      password: MOCK_PASSWORD,
    });
  });

  it('401: credenciales inválidas, sin cookies', async () => {
    const response = await postLogin({
      username: 'admin',
      password: 'otra-clave-larga-1',
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({
      statusCode: 401,
      message: 'Credenciales inválidas',
      error: 'Unauthorized',
    });
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('400: reenvía la lista de mensajes del back', async () => {
    const response = await postLogin({ username: 'admin', password: 'corta' });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { message: string[] };
    expect(body.message).toEqual([
      'password debe tener entre 12 y 128 caracteres',
    ]);
  });

  it('429 del back', async () => {
    const response = await postLogin({
      username: 'limitado',
      password: MOCK_PASSWORD,
    });
    expect(response.status).toBe(429);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('cuerpo que no es un objeto JSON → 400 sin llamar al back', async () => {
    for (const body of ['"texto"', '[1]', 'no-json']) {
      const response = await login(
        new Request(`http://${HOST}/api/auth/login`, {
          method: 'POST',
          headers: json,
          body,
        }),
      );
      expect(response.status).toBe(400);
    }
    expect(mock.requests).toHaveLength(0);
  });

  it('back apagado → 502', async () => {
    env.API_URL = 'http://127.0.0.1:1/api/v1';
    const response = await postLogin({
      username: 'admin',
      password: MOCK_PASSWORD,
    });
    expect(response.status).toBe(502);
    expect(response.headers.getSetCookie()).toEqual([]);
  });

  it('si /auth/me falla, no deja sesión: 502, sin cookies y revoca la sesión creada', async () => {
    mock.behavior.failMe = true;
    const response = await postLogin({
      username: 'admin',
      password: MOCK_PASSWORD,
    });
    expect(response.status).toBe(502);
    expect(response.headers.getSetCookie()).toEqual([]);
    const paths = mock.requests.map((r) => `${r.method} ${r.path}`);
    expect(paths).toEqual([
      'POST /api/v1/auth/login',
      'GET /api/v1/auth/me',
      'POST /api/v1/auth/logout',
    ]);
  });

  it('CSRF: sin Origin → 403; formulario → 415', async () => {
    const noOrigin = await login(
      new Request(`http://${HOST}/api/auth/login`, {
        method: 'POST',
        headers: { host: HOST, 'content-type': 'application/json' },
        body: '{}',
      }),
    );
    expect(noOrigin.status).toBe(403);
    const form = await login(
      new Request(`http://${HOST}/api/auth/login`, {
        method: 'POST',
        headers: {
          host: HOST,
          origin: `http://${HOST}`,
          'content-type': 'application/x-www-form-urlencoded',
        },
        body: 'username=admin',
      }),
    );
    expect(form.status).toBe(415);
    expect(mock.requests).toHaveLength(0);
  });

  it('envía al back la IP real del cliente (límite por IP, CA-24)', async () => {
    env.TRUST_PROXY_HOPS = 1;
    await postLogin(
      { username: 'admin', password: MOCK_PASSWORD },
      { 'x-forwarded-for': '1.2.3.4, 9.9.9.9' },
    );
    for (const request of mock.requests)
      expect(request.headers['x-forwarded-for']).toBe('9.9.9.9');
  });
});

async function loggedIn(
  username = 'admin',
): Promise<{ cookie: string; token: string }> {
  const response = await postLogin({ username, password: MOCK_PASSWORD });
  const cookies = cookiesOf(response);
  mock.requests.length = 0;
  return {
    cookie: `session=${cookies.session}; session_exp=${cookies.session_exp}`,
    token: cookies.session!,
  };
}

const sessionRequest = (cookie?: string) =>
  session(
    new Request(`http://${HOST}/api/auth/session`, {
      headers: cookie ? { cookie } : {},
    }),
  );

describe('GET /api/auth/session', () => {
  it('con sesión vigente responde usuario y vencimiento', async () => {
    const { cookie } = await loggedIn('repartidor');
    const response = await sessionRequest(cookie);
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      user: { role: string };
      expiresAt: number;
    };
    expect(body.user.role).toBe('repartidor');
    expect(body.expiresAt).toBeGreaterThan(Date.now());
  });

  it('sin cookie → 401 sin llamar al back', async () => {
    const response = await sessionRequest();
    expect(response.status).toBe(401);
    expect(mock.requests).toHaveLength(0);
  });

  it('sesión revocada en el back → 401 y borra las cookies', async () => {
    const { cookie } = await loggedIn();
    mock.revokeAllSessions();
    const response = await sessionRequest(cookie);
    expect(response.status).toBe(401);
    expect(response.headers.getSetCookie()).toHaveLength(2);
    expect(
      response.headers
        .getSetCookie()
        .every((line) => line.includes('Max-Age=0')),
    ).toBe(true);
  });

  it('back caído → 502 y NO borra las cookies', async () => {
    const { cookie } = await loggedIn();
    mock.behavior.failMe = true;
    const response = await sessionRequest(cookie);
    expect(response.status).toBe(502);
    expect(response.headers.getSetCookie()).toEqual([]);
  });
});

const postLogout = (cookie?: string, extra: Record<string, string> = {}) =>
  logout(
    new Request(`http://${HOST}/api/auth/logout`, {
      method: 'POST',
      headers: {
        host: HOST,
        origin: `http://${HOST}`,
        ...(cookie ? { cookie } : {}),
        ...extra,
      },
    }),
  );

describe('POST /api/auth/logout (CA-17)', () => {
  it('revoca la sesión en el back y borra las cookies', async () => {
    const { cookie, token } = await loggedIn();
    const response = await postLogout(cookie);
    expect(response.status).toBe(204);
    expect(
      response.headers
        .getSetCookie()
        .every((line) => line.includes('Max-Age=0')),
    ).toBe(true);
    expect(mock.requests[0]).toMatchObject({
      method: 'POST',
      path: '/api/v1/auth/logout',
    });
    expect(mock.requests[0]!.headers.authorization).toBe(`Bearer ${token}`);
    // El token revocado ya no sirve en el back.
    const me = await fetch(`${mock.url}/auth/me`, {
      headers: { authorization: `Bearer ${token}` },
    });
    expect(me.status).toBe(401);
  });

  it('aunque el back falle, borra las cookies', async () => {
    const { cookie } = await loggedIn();
    env.API_URL = 'http://127.0.0.1:1/api/v1';
    const response = await postLogout(cookie);
    expect(response.status).toBe(204);
    expect(response.headers.getSetCookie()).toHaveLength(2);
  });

  it('sin cookie igualmente responde 204 y no llama al back', async () => {
    const response = await postLogout();
    expect(response.status).toBe(204);
    expect(mock.requests).toHaveLength(0);
  });

  it('exige Origin propio (CSRF)', async () => {
    const response = await postLogout('session=x', {
      origin: 'https://evil.test',
    });
    expect(response.status).toBe(403);
    expect(mock.requests).toHaveLength(0);
  });
});

describe('GET /api/auth/expired (CA-12, CA-13)', () => {
  const call = (query = '') =>
    expired(new Request(`http://${HOST}/api/auth/expired${query}`));

  it('borra las cookies y redirige a /login?expired=1&next=…', async () => {
    const response = call('?next=%2Fadmin%2Fusuarios');
    expect(response.status).toBe(303);
    expect(response.headers.get('location')).toBe(
      '/login?expired=1&next=%2Fadmin%2Fusuarios',
    );
    expect(response.headers.getSetCookie()).toHaveLength(2);
    expect(
      response.headers
        .getSetCookie()
        .every((line) => line.includes('Max-Age=0')),
    ).toBe(true);
  });

  it.each(['//evil.test', 'https://evil.test', '/\\evil.test', ''])(
    'ignora next %j',
    (next) => {
      const response = call(`?next=${encodeURIComponent(next)}`);
      expect(response.headers.get('location')).toBe('/login?expired=1');
    },
  );

  it('sin next, redirige igual', () => {
    expect(call().headers.get('location')).toBe('/login?expired=1');
  });

  it('nunca llama al back', () => {
    call('?next=%2Fadmin');
    expect(mock.requests).toHaveLength(0);
  });
});
