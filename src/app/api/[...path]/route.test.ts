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

import { DELETE, GET, PATCH, POST, PUT } from './route';

let mock: MockApi;
beforeAll(async () => {
  mock = await startMockApi();
  env.API_URL = mock.url;
});
afterAll(async () => {
  await mock.close();
});
beforeEach(() => {
  mock.reset();
  env.TRUST_PROXY_HOPS = 0;
  env.ALLOWED_ORIGINS = [];
});

const HOST = 'localhost:3001';
const registration = JSON.stringify({
  email: 'ruta@example.com',
  password: MOCK_PASSWORD,
  fullName: 'Prueba Ruta',
  phone: '3001234567',
});

function post(headers: Record<string, string>, body = registration): Request {
  // Un servidor real recibe `Host`; una Request construida a mano no lo trae.
  return new Request(`http://${HOST}/api/customers`, {
    method: 'POST',
    headers: { host: HOST, ...headers },
    body,
  });
}

describe('CSRF (CA-16)', () => {
  it.each([
    ['POST', POST],
    ['PUT', PUT],
    ['PATCH', PATCH],
    ['DELETE', DELETE],
  ])('%s sin Origin → 403 sin llamar al back', async (method, handler) => {
    const response = await handler(
      new Request(`http://${HOST}/api/customers`, {
        method,
        headers: { 'content-type': 'application/json' },
        body: '{}',
      }),
    );
    expect(response.status).toBe(403);
    expect(await response.json()).toMatchObject({
      statusCode: 403,
      error: 'Forbidden',
    });
    expect(mock.requests).toHaveLength(0);
  });

  it('Origin de otro sitio → 403', async () => {
    const response = await POST(
      post({ 'content-type': 'application/json', origin: 'https://evil.test' }),
    );
    expect(response.status).toBe(403);
    expect(mock.requests).toHaveLength(0);
  });

  it('formulario clásico (otro Content-Type) → 415', async () => {
    const response = await POST(
      post(
        {
          'content-type': 'application/x-www-form-urlencoded',
          origin: `http://${HOST}`,
        },
        'a=b',
      ),
    );
    expect(response.status).toBe(415);
    expect(mock.requests).toHaveLength(0);
  });

  it('Origin propio y JSON → llega al back', async () => {
    const response = await POST(
      post({ 'content-type': 'application/json', origin: `http://${HOST}` }),
    );
    expect(response.status).toBe(201);
    expect(mock.requests).toHaveLength(1);
  });

  it('ALLOWED_ORIGINS permite otro origen exacto', async () => {
    env.ALLOWED_ORIGINS = ['https://otro.example.com'];
    const response = await POST(
      post({
        'content-type': 'application/json',
        origin: 'https://otro.example.com',
      }),
    );
    expect(response.status).toBe(201);
  });

  it('un GET no necesita Origin', async () => {
    const response = await GET(new Request(`http://${HOST}/api/menu`));
    expect(response.status).toBe(200);
  });

  it('la verificación va antes de la tabla de rutas: ruta desconocida sin Origin → 403', async () => {
    const response = await POST(
      new Request(`http://${HOST}/api/secreto`, { method: 'POST', body: '{}' }),
    );
    expect(response.status).toBe(403);
  });
});

describe('pasarela por la ruta de Next (CA-15, CA-24)', () => {
  it('ruta fuera de la tabla → 404 en el formato estándar', async () => {
    const response = await GET(new Request(`http://${HOST}/api/secreto`));
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      statusCode: 404,
      error: 'Not Found',
    });
  });

  it('privada sin cookie → 401 local', async () => {
    const response = await GET(new Request(`http://${HOST}/api/users`));
    expect(response.status).toBe(401);
    expect(mock.requests).toHaveLength(0);
  });

  it('con TRUST_PROXY_HOPS=1 el back recibe solo la IP añadida por el proxy', async () => {
    env.TRUST_PROXY_HOPS = 1;
    await GET(
      new Request(`http://${HOST}/api/menu`, {
        headers: { 'x-forwarded-for': '1.2.3.4, 9.9.9.9' },
      }),
    );
    expect(mock.requests[0]!.headers['x-forwarded-for']).toBe('9.9.9.9');
  });

  it('el mensaje de validación del back llega intacto', async () => {
    const response = await POST(
      post(
        { 'content-type': 'application/json', origin: `http://${HOST}` },
        JSON.stringify({
          email: 'x',
          password: 'corta',
          fullName: 'A',
          phone: '1',
        }),
      ),
    );
    expect(response.status).toBe(400);
    const body = (await response.json()) as { message: string[] };
    expect(body.message).toHaveLength(4);
  });

  describe('admin: usuarios por la pasarela (007a)', () => {
    async function adminCookie(): Promise<string> {
      const login = await fetch(`${mock.url}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: MOCK_PASSWORD }),
      });
      const { accessToken } = (await login.json()) as { accessToken: string };
      return `session=${accessToken}`;
    }
    const call = (
      handler: typeof GET,
      method: string,
      path: string,
      cookie: string,
      body?: unknown,
    ) =>
      handler(
        new Request(`http://${HOST}/api${path}`, {
          method,
          headers: {
            host: HOST,
            origin: `http://${HOST}`,
            'content-type': 'application/json',
            cookie,
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
      );

    it('GET /api/users envía search y role al back y devuelve la página filtrada', async () => {
      const cookie = await adminCookie();
      const response = await call(
        GET,
        'GET',
        '/users?page=1&limit=20&search=carlos&role=admin%2Coperador%2Crepartidor',
        cookie,
      );
      expect(response.status).toBe(200);
      const page = (await response.json()) as {
        total: number;
        data: { username: string }[];
      };
      expect(page.total).toBe(1);
      expect(page.data[0]?.username).toBe('repartidor');
      expect(mock.requests.at(-1)).toMatchObject({
        path: '/api/v1/users',
        query:
          '?page=1&limit=20&search=carlos&role=admin%2Coperador%2Crepartidor',
      });
    });

    it('un 400 del filtro llega intacto', async () => {
      const cookie = await adminCookie();
      const response = await call(GET, 'GET', '/users?role=jefe', cookie);
      expect(response.status).toBe(400);
    });

    it('crea, cambia el rol y elimina por la pasarela', async () => {
      const cookie = await adminCookie();
      const created = await call(POST, 'POST', '/users', cookie, {
        username: 'ruta.op',
        password: 'clave-generica',
        role: 'operador',
      });
      expect(created.status).toBe(201);
      const { id } = (await created.json()) as { id: string };
      const role = await call(PATCH, 'PATCH', `/users/${id}/role`, cookie, {
        role: 'admin',
      });
      expect(role.status).toBe(200);
      const edited = await call(PATCH, 'PATCH', `/users/${id}`, cookie, {
        fullName: 'Ruta Admin',
      });
      expect(edited.status).toBe(200);
      const removed = await call(DELETE, 'DELETE', `/users/${id}`, cookie);
      expect(removed.status).toBe(204);
    });

    it('el 409 de cambiar el propio rol llega con el texto del back', async () => {
      const cookie = await adminCookie();
      const response = await call(
        PATCH,
        'PATCH',
        '/users/u-admin/role',
        cookie,
        { role: 'operador' },
      );
      expect(response.status).toBe(409);
    });
  });

  describe('admin: catálogo por la pasarela (007b)', () => {
    async function adminCookie(): Promise<string> {
      const login = await fetch(`${mock.url}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: MOCK_PASSWORD }),
      });
      const { accessToken } = (await login.json()) as { accessToken: string };
      return `session=${accessToken}`;
    }
    const call = (
      handler: typeof GET,
      method: string,
      path: string,
      cookie: string,
      body?: unknown,
    ) =>
      handler(
        new Request(`http://${HOST}/api${path}`, {
          method,
          headers: {
            host: HOST,
            origin: `http://${HOST}`,
            'content-type': 'application/json',
            cookie,
          },
          ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        }),
      );

    it('GET /api/products envía search, category y active al back', async () => {
      const cookie = await adminCookie();
      const response = await call(
        GET,
        'GET',
        '/products?page=1&limit=20&search=espresso&category=cafe&active=true',
        cookie,
      );
      expect(response.status).toBe(200);
      const page = (await response.json()) as { total: number };
      expect(page.total).toBe(1);
      expect(mock.requests.at(-1)).toMatchObject({
        path: '/api/v1/products',
        query: '?page=1&limit=20&search=espresso&category=cafe&active=true',
      });
    });

    it('crea, edita, cambia estado, recompone y elimina por la pasarela', async () => {
      const cookie = await adminCookie();
      const part = async (sku: string) => {
        const r = await call(GET, 'GET', `/products?search=${sku}`, cookie);
        return ((await r.json()) as { data: { id: string }[] }).data[0]!.id;
      };
      const created = await call(POST, 'POST', '/products', cookie, {
        sku: 'RUTA-1',
        name: 'Ruta',
        category: 'snack',
        price: 2000,
        cost: 500,
      });
      expect(created.status).toBe(201);
      const { id } = (await created.json()) as { id: string };
      expect(
        (await call(PATCH, 'PATCH', `/products/${id}`, cookie, { price: 2500 }))
          .status,
      ).toBe(200);
      expect(
        (
          await call(PATCH, 'PATCH', `/products/${id}/status`, cookie, {
            active: false,
          })
        ).status,
      ).toBe(200);
      const combo = await part('CMB-CLAS');
      const put = await call(
        PUT,
        'PUT',
        `/products/${combo}/components`,
        cookie,
        {
          components: [
            { productId: await part('CAF-ESPR'), quantity: 1 },
            { productId: await part('PAS-BROW'), quantity: 1 },
          ],
        },
      );
      expect(put.status).toBe(200);
      expect(
        (await call(DELETE, 'DELETE', `/products/${id}`, cookie)).status,
      ).toBe(204);
    });

    it('el 409 de SKU repetido llega con el texto del back', async () => {
      const cookie = await adminCookie();
      const response = await call(POST, 'POST', '/products', cookie, {
        sku: 'CAF-ESPR',
        name: 'Otro',
        category: 'cafe',
        price: 1000,
        cost: 100,
      });
      expect(response.status).toBe(409);
      expect(((await response.json()) as { message: string }).message).toBe(
        'El SKU ya existe.',
      );
    });
  });

  describe('cliente: perfil y contraseña por la pasarela (006)', () => {
    async function customerCookie(): Promise<string> {
      const login = await fetch(`${mock.url}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          email: 'cliente@example.com',
          password: MOCK_PASSWORD,
        }),
      });
      const { accessToken } = (await login.json()) as { accessToken: string };
      return `session=${accessToken}`;
    }
    const patch = (path: string, cookie: string, body: unknown) =>
      PATCH(
        new Request(`http://${HOST}/api${path}`, {
          method: 'PATCH',
          headers: {
            host: HOST,
            origin: `http://${HOST}`,
            'content-type': 'application/json',
            cookie,
          },
          body: JSON.stringify(body),
        }),
      );

    it('PATCH /api/auth/password pasa por la pasarela comodín (no solo login/logout)', async () => {
      const cookie = await customerCookie();
      const response = await patch('/auth/password', cookie, {
        currentPassword: MOCK_PASSWORD,
        newPassword: 'Otra-Clave-98765',
      });
      expect(response.status).toBe(204);
      expect(mock.requests.at(-1)).toMatchObject({
        method: 'PATCH',
        path: '/api/v1/auth/password',
      });
    });

    it('el 403 de «contraseña actual incorrecta» llega intacto y no borra la sesión', async () => {
      const cookie = await customerCookie();
      const response = await patch('/auth/password', cookie, {
        currentPassword: 'Incorrecta-12345',
        newPassword: 'Otra-Clave-98765',
      });
      expect(response.status).toBe(403);
      expect(await response.json()).toMatchObject({
        message: 'La contraseña actual no es correcta.',
      });
      expect(response.headers.get('set-cookie') ?? '').not.toMatch(/session=;/);
    });

    it('PATCH /api/customers/me llega al back', async () => {
      const cookie = await customerCookie();
      const response = await patch('/customers/me', cookie, {
        phone: '300 765 4322',
      });
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ phone: '+573007654322' });
    });
  });

  describe('admin: pedidos y rondas por la pasarela (007d)', () => {
    async function adminCookie(): Promise<string> {
      const login = await fetch(`${mock.url}/auth/login`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'admin', password: MOCK_PASSWORD }),
      });
      const { accessToken } = (await login.json()) as { accessToken: string };
      return `session=${accessToken}`;
    }
    const get = (path: string, cookie: string) =>
      GET(
        new Request(`http://${HOST}/api${path}`, {
          method: 'GET',
          headers: { host: HOST, cookie },
        }),
      );

    it('GET /api/orders envía page, limit y status al back', async () => {
      const response = await get(
        '/orders?page=1&limit=20&status=en_camino',
        await adminCookie(),
      );
      expect(response.status).toBe(200);
      expect(mock.requests.at(-1)).toMatchObject({
        path: '/api/v1/orders',
        query: '?page=1&limit=20&status=en_camino',
      });
    });

    it('GET /api/orders/:id responde 404 con el texto del back', async () => {
      const response = await get(
        '/orders/0b1f6f8e-9a0c-4f3e-9d5e-0a1b2c3d4e5f',
        await adminCookie(),
      );
      expect(response.status).toBe(404);
    });

    it('GET /api/dispatch/rounds envía el filtro de estado y trae todas las rondas', async () => {
      const response = await get(
        '/dispatch/rounds?page=1&limit=20&status=activa',
        await adminCookie(),
      );
      expect(response.status).toBe(200);
      expect(mock.requests.at(-1)).toMatchObject({
        path: '/api/v1/dispatch/rounds',
        query: '?page=1&limit=20&status=activa',
      });
    });
  });
});
