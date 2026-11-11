/**
 * API simulada del back de Mocca Go para pruebas de integración y E2E.
 * Solo usa sintaxis que Node 24 ejecuta sin transpilar.
 *
 * Usuarios (contraseña MOCK_PASSWORD): admin, operador, repartidor, cliente@example.com,
 * y `corta` (operador cuya sesión dura 3 s). Casos especiales:
 *   - login con `limitado` → 429
 *   - registro con `ocupado@example.com` → 409; con `limitado@example.com` → 429
 *   - GET /menu devuelve `{ data }` (20 productos y 3 combos); respeta behavior.menuDelayMs
 *     y behavior.menuStatus (≠ 0 responde ese error). Control para E2E, fuera de /api/v1:
 *     POST /__mock/menu `{ sku, available?, price?, remove? | restore? }` y POST /__mock/menu/reset
 *   - Pedidos: GET /delivery-zones, POST/GET /orders, GET /orders/:id, POST /orders/:id/cancel
 *     (tarjeta 4000000000000002 → 402; producto agotado → 409; misma Idempotency-Key → 200).
 *     Control: POST /__mock/orders/:id/status `{status}`, /__mock/orders/behavior `{createStatus}`
 *     y /__mock/orders/reset
 *   - behavior.failMe hace que GET /auth/me responda 500
 *   - GET /orders/stream (solo cliente): canal SSE real (`ready`, `order` al crear/avanzar/cancelar, latido cada
 *     behavior.heartbeatMs). Control: POST /__mock/stream/behavior `{status?, silent?, heartbeatMs?, mode?}`,
 *     POST /__mock/stream/drop y GET /__mock/stream/count.
 *   - Cocina (operador y admin): GET /kitchen/orders?status=, POST /kitchen/orders/:id/start|ready, GET /kitchen/stream
 *     (recibe los cambios de cualquier cliente) y POST /orders/:id/cancel con `{reason}` para el personal. Con behavior.streamMode = 'legacy' emite 3 fragmentos
 *     separados por behavior.streamGapMs (prueba de la pasarela)
 *   - Despacho (repartidor): GET /dispatch/queue, POST /dispatch/rounds, GET /dispatch/rounds(/:id), POST /dispatch/orders/:id/deliver|fail y
 *     GET /dispatch/stream, con los textos de error del back real. Control: POST /__mock/dispatch `{courier?, profile?: 'incompleto'|'completo', scope?: ids[]|null, foreign?: ids[], reset?}`
 */
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import type {
  IncomingHttpHeaders,
  IncomingMessage,
  ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';
import { createDispatchStore } from './dispatch.ts';
import { createInventoryStore } from './inventory.ts';
import { buildMenu, type MockMenuItem } from './menu.ts';
import { buildZones, createOrderStore, type OrderStatus } from './orders.ts';

export const MOCK_PASSWORD = 'Password-123456';
const PREFIX = '/api/v1';

type Role = 'admin' | 'operador' | 'repartidor' | 'cliente';
const isStaff = (role: Role): boolean =>
  role === 'operador' || role === 'admin';
interface MockUser {
  id: string;
  username: string;
  role: Role;
  expiresIn: number;
}
interface Customer {
  id: string;
  email: string;
  password: string;
  fullName: string;
  phone: string;
}

export interface RecordedRequest {
  method: string;
  path: string;
  query: string;
  headers: IncomingHttpHeaders;
  body: string;
}

export interface MockApi {
  url: string;
  port: number;
  /** Peticiones recibidas desde el último `reset()`. */
  requests: RecordedRequest[];
  behavior: {
    menuDelayMs: number;
    /** Si no es 0, `GET /menu` responde con ese estado de error. */
    menuStatus: number;
    /** Si no es 0, `POST /orders` responde con ese estado de error. */
    createOrderStatus: number;
    streamGapMs: number;
    failMe: boolean;
    /** `live`: canal SSE real (ready, order, latidos). `legacy`: tres fragmentos y cierre (prueba de la pasarela). */
    streamMode: 'live' | 'legacy';
    /** Si no es 0, `GET /orders/stream` responde con ese estado de error. */
    streamStatus: number;
    /** Si es true, el canal se abre pero no envía nada (ni `ready` ni latidos). */
    streamSilent: boolean;
    /** Cada cuánto el canal envía un latido. */
    heartbeatMs: number;
  };
  /** Menú vigente (se puede modificar en las pruebas). */
  menu: MockMenuItem[];
  /** Cuántos flujos SSE terminaron de emitir. */
  streamsFinished: number;
  reset(): void;
  /** Invalida todos los tokens emitidos (simula sesión revocada o vencida en el back). */
  revokeAllSessions(): void;
  close(): Promise<void>;
}

/** Nombre de usuario interno de un cliente (17 caracteres hexadecimales, ilegible a propósito). */
export function internalUsername(email: string): string {
  return createHash('sha1').update(email).digest('hex').slice(0, 17);
}

const STAFF: MockUser[] = [
  { id: 'u-admin', username: 'admin', role: 'admin', expiresIn: 900 },
  { id: 'u-operador', username: 'operador', role: 'operador', expiresIn: 900 },
  {
    id: 'u-repartidor',
    username: 'repartidor',
    role: 'repartidor',
    expiresIn: 900,
  },
  {
    id: 'u-repartidor-2',
    username: 'repartidor2',
    role: 'repartidor',
    expiresIn: 900,
  },
  { id: 'u-corta', username: 'corta', role: 'operador', expiresIn: 3 },
];

function send(res: ServerResponse, status: number, body?: unknown): void {
  if (body === undefined) {
    res.writeHead(status).end();
    return;
  }
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

const REASONS: Record<number, string> = {
  400: 'Bad Request',
  402: 'Payment Required',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  429: 'Too Many Requests',
};
function fail(
  res: ServerResponse,
  statusCode: number,
  message: string | string[],
): void {
  send(res, statusCode, {
    statusCode,
    message,
    error: REASONS[statusCode] ?? 'Error',
  });
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  return Buffer.concat(chunks).toString('utf8');
}

function parseJson(text: string): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(text);
    return typeof value === 'object' && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

const text = (value: unknown): value is string => typeof value === 'string';

export async function startMockApi(
  options: { port?: number; host?: string } = {},
): Promise<MockApi> {
  const customers: Customer[] = [];
  const sessions = new Map<string, MockUser>();
  let counter = 0;

  const resetCustomers = () => {
    customers.length = 0;
    customers.push(
      {
        id: 'c-1',
        email: 'cliente@example.com',
        password: MOCK_PASSWORD,
        fullName: 'Cliente Demo',
        phone: '+573001234567',
      },
      {
        id: 'c-2',
        email: 'ocupado@example.com',
        password: MOCK_PASSWORD,
        fullName: 'Correo Ocupado',
        phone: '+573001234568',
      },
    );
  };
  resetCustomers();

  const inventory = createInventoryStore(() => state.menu);
  const orderStore = createOrderStore(
    () => inventory.menu(),
    () => buildZones(),
    (customerId, order) => {
      const frame = `event: order\ndata: ${JSON.stringify({
        number: order.number,
        status: order.status,
        at: order.updatedAt,
      })}\n\n`;
      for (const channel of channels) {
        if (channel.kitchen || channel.customerId === customerId)
          channel.res.write(frame);
      }
    },
  );

  const dispatch = createDispatchStore(orderStore, () => buildZones());

  /** Canales SSE abiertos (`/orders/stream` en modo `live`). */
  const channels = new Set<{
    customerId: string;
    kitchen: boolean;
    res: ServerResponse;
  }>();
  function dropChannels(): void {
    for (const channel of [...channels]) channel.res.end();
    channels.clear();
  }

  const state: MockApi = {
    url: '',
    port: 0,
    requests: [],
    behavior: {
      menuDelayMs: 0,
      menuStatus: 0,
      createOrderStatus: 0,
      streamGapMs: 150,
      failMe: false,
      streamMode: 'live',
      streamStatus: 0,
      streamSilent: false,
      heartbeatMs: 5_000,
    },
    menu: buildMenu(),
    streamsFinished: 0,
    reset() {
      state.requests.length = 0;
      state.behavior.menuDelayMs = 0;
      state.behavior.menuStatus = 0;
      state.behavior.createOrderStatus = 0;
      state.menu = buildMenu();
      inventory.reset();
      orderStore.reset();
      dispatch.reset();
      state.behavior.streamGapMs = 150;
      state.behavior.failMe = false;
      state.behavior.streamMode = 'live';
      state.behavior.streamStatus = 0;
      state.behavior.streamSilent = false;
      state.behavior.heartbeatMs = 5_000;
      dropChannels();
      state.streamsFinished = 0;
      sessions.clear();
      resetCustomers();
    },
    revokeAllSessions() {
      sessions.clear();
    },
    close: () => Promise.resolve(),
  };

  function authenticate(
    req: IncomingMessage,
  ): { token: string; user: MockUser } | null {
    const match = /^Bearer (.+)$/.exec(req.headers.authorization ?? '');
    const token = match?.[1];
    const user = token ? sessions.get(token) : undefined;
    return token && user ? { token, user } : null;
  }

  function issue(res: ServerResponse, user: MockUser): void {
    counter += 1;
    const token = `mock-${user.role}-${counter}`;
    sessions.set(token, user);
    send(res, 200, {
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn: user.expiresIn,
    });
  }

  function login(
    res: ServerResponse,
    body: Record<string, unknown> | null,
  ): void {
    if (!body) return fail(res, 400, ['El cuerpo debe ser un objeto JSON']);
    const { username, email, password } = body;
    const problems: string[] = [];
    if (!text(password) || password.length < 12 || password.length > 128) {
      problems.push('password debe tener entre 12 y 128 caracteres');
    }
    if (text(username) === text(email)) {
      problems.push('Se debe enviar exactamente uno de username o email');
    } else if (
      text(username) &&
      !/^[a-z0-9][a-z0-9._-]{2,63}$/.test(username)
    ) {
      problems.push('username no cumple el formato permitido');
    }
    if (problems.length > 0) return fail(res, 400, problems);

    if (username === 'limitado')
      return fail(res, 429, 'ThrottlerException: Too Many Requests');

    if (text(username)) {
      const user = STAFF.find((u) => u.username === username);
      if (user && password === MOCK_PASSWORD) return issue(res, user);
    } else if (text(email)) {
      const customer = customers.find((c) => c.email === email);
      if (customer && customer.password === password) {
        return issue(res, {
          id: customer.id,
          // Como el back real: un identificador interno, no el correo ni el nombre.
          username: internalUsername(customer.email),
          role: 'cliente',
          expiresIn: 900,
        });
      }
    }
    fail(res, 401, 'Credenciales inválidas');
  }

  function register(
    res: ServerResponse,
    body: Record<string, unknown> | null,
  ): void {
    if (!body) return fail(res, 400, ['El cuerpo debe ser un objeto JSON']);
    const { email, password, fullName, phone } = body;
    const problems: string[] = [];
    if (
      !text(email) ||
      !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) ||
      email.length > 254
    ) {
      problems.push('email debe ser un correo válido');
    }
    if (!text(password) || password.length < 12 || password.length > 128) {
      problems.push('password debe tener entre 12 y 128 caracteres');
    }
    if (
      !text(fullName) ||
      fullName.trim().length < 2 ||
      fullName.length > 100
    ) {
      problems.push('fullName debe tener entre 2 y 100 caracteres');
    }
    if (!text(phone) || !/^(\+\d{8,15}|3\d{9})$/.test(phone)) {
      problems.push(
        'phone debe ser un celular colombiano o un número internacional',
      );
    }
    if (problems.length > 0) return fail(res, 400, problems);

    const customer = { email, password, fullName, phone } as {
      [K in 'email' | 'password' | 'fullName' | 'phone']: string;
    };
    if (customer.email === 'limitado@example.com') {
      return fail(res, 429, 'ThrottlerException: Too Many Requests');
    }
    if (customers.some((c) => c.email === customer.email)) {
      return fail(res, 409, 'El correo ya está registrado');
    }
    counter += 1;
    const created = { id: `c-${counter + 100}`, ...customer };
    customers.push(created);
    send(res, 201, {
      id: created.id,
      email: created.email,
      fullName: created.fullName,
      phone: created.phone,
    });
  }

  async function handle(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://mock.local');
    const body = await readBody(req);
    state.requests.push({
      method: req.method ?? 'GET',
      path: url.pathname,
      query: url.search,
      headers: req.headers,
      body,
    });

    if (url.pathname === '/__mock/menu/reset' && req.method === 'POST') {
      state.menu = buildMenu();
      return send(res, 204);
    }
    if (url.pathname === '/__mock/menu' && req.method === 'POST') {
      const change = parseJson(body);
      if (change?.restore === true) {
        // Devuelve un solo producto a su estado original sin tocar los demás.
        const base = buildMenu();
        const original = base.find((p) => p.sku === change.sku);
        if (!original) return fail(res, 404, 'Producto no encontrado');
        const rest = state.menu.filter((p) => p.sku !== original.sku);
        state.menu = [...rest, original].sort(
          (a, b) =>
            base.findIndex((p) => p.sku === a.sku) -
            base.findIndex((p) => p.sku === b.sku),
        );
        return send(res, 204);
      }
      const product = state.menu.find((p) => p.sku === change?.sku);
      if (!change || !product) return fail(res, 404, 'Producto no encontrado');
      if (change.remove === true)
        state.menu = state.menu.filter((p) => p !== product);
      if (typeof change.available === 'boolean')
        product.available = change.available;
      if (typeof change.price === 'number') product.price = change.price;
      return send(res, 204);
    }

    if (url.pathname === '/__mock/inventory/reset' && req.method === 'POST') {
      inventory.reset();
      return send(res, 204);
    }
    if (url.pathname === '/__mock/inventory' && req.method === 'POST') {
      const change = parseJson(body);
      const sku = change?.sku;
      if (!text(sku)) return fail(res, 400, 'sku requerido');
      if (typeof change?.soldOut === 'boolean')
        inventory.setSoldOut(`prod-${sku.toLowerCase()}`, {
          soldOut: change.soldOut,
        });
      if (
        typeof change?.stock === 'number' &&
        !inventory.setStock(sku, change.stock)
      )
        return fail(res, 404, 'Producto no encontrado');
      if (
        typeof change?.active === 'boolean' &&
        !inventory.setActive(sku, change.active)
      )
        return fail(res, 404, 'Producto no encontrado');
      return send(res, 204);
    }

    const orderControl = /^\/__mock\/orders\/([^/]+)\/status$/.exec(
      url.pathname,
    );
    if (orderControl && req.method === 'POST') {
      const change = parseJson(body);
      if (!change || typeof change.status !== 'string')
        return fail(res, 400, 'status requerido');
      const r = orderStore.advance(
        orderControl[1] ?? '',
        change.status as OrderStatus,
      );
      return send(res, r.status, r.status === 204 ? undefined : r.body);
    }
    if (url.pathname === '/__mock/orders/behavior' && req.method === 'POST') {
      const change = parseJson(body);
      state.behavior.createOrderStatus = Number(change?.createStatus ?? 0);
      return send(res, 204);
    }
    if (url.pathname === '/__mock/stream/behavior' && req.method === 'POST') {
      const change = parseJson(body);
      if (typeof change?.status === 'number')
        state.behavior.streamStatus = change.status;
      if (typeof change?.silent === 'boolean')
        state.behavior.streamSilent = change.silent;
      if (typeof change?.heartbeatMs === 'number')
        state.behavior.heartbeatMs = change.heartbeatMs;
      if (change?.mode === 'live' || change?.mode === 'legacy')
        state.behavior.streamMode = change.mode;
      return send(res, 204);
    }
    if (url.pathname === '/__mock/stream/drop' && req.method === 'POST') {
      dropChannels();
      return send(res, 204);
    }
    if (url.pathname === '/__mock/stream/count' && req.method === 'GET') {
      return send(res, 200, { open: channels.size });
    }
    if (url.pathname === '/__mock/orders/reset' && req.method === 'POST') {
      orderStore.reset();
      dispatch.reset();
      return send(res, 204);
    }
    if (url.pathname === '/__mock/dispatch' && req.method === 'POST') {
      const change = parseJson(body);
      const courier = text(change?.courier) ? change.courier : undefined;
      if (change?.reset === true) dispatch.reset();
      if (change?.profile === 'incompleto')
        dispatch.setProfile({ fullName: null, phone: null }, courier);
      if (change?.profile === 'completo') dispatch.restoreProfile(courier);
      if (change && 'scope' in change) {
        const scope = change.scope;
        dispatch.setScope(
          Array.isArray(scope) ? scope.map(String) : null,
          courier,
        );
      }
      if (Array.isArray(change?.foreign)) {
        const r = dispatch.foreign(change.foreign.map(String));
        if (r.status !== 204) return send(res, r.status, r.body);
      }
      return send(res, 204);
    }

    if (!url.pathname.startsWith(`${PREFIX}/`))
      return fail(res, 404, 'Not Found');
    const route = `${req.method} ${url.pathname.slice(PREFIX.length)}`;
    const session = authenticate(req);

    switch (route) {
      case 'POST /auth/login':
        return login(res, parseJson(body));
      case 'GET /auth/me':
        if (state.behavior.failMe)
          return fail(res, 500, 'Internal server error');
        if (!session) return fail(res, 401, 'Unauthorized');
        return send(res, 200, {
          id: session.user.id,
          username: session.user.username,
          role: session.user.role,
        });
      case 'POST /auth/logout':
        if (!session) return fail(res, 401, 'Unauthorized');
        sessions.delete(session.token);
        return send(res, 204);
      case 'POST /customers':
        return register(res, parseJson(body));
      case 'GET /customers/me': {
        if (!session) return fail(res, 401, 'Unauthorized');
        if (session.user.role !== 'cliente')
          return fail(res, 403, 'Forbidden resource');
        const customer = customers.find((c) => c.id === session.user.id);
        if (!customer) return fail(res, 404, 'Cliente no encontrado');
        return send(res, 200, {
          id: customer.id,
          email: customer.email,
          fullName: customer.fullName,
          phone: customer.phone,
        });
      }
      case 'GET /menu':
        if (state.behavior.menuDelayMs > 0) {
          await new Promise((resolve) =>
            setTimeout(resolve, state.behavior.menuDelayMs),
          );
        }
        if (state.behavior.menuStatus !== 0)
          return fail(res, state.behavior.menuStatus, 'Error simulado');
        return send(res, 200, { data: inventory.menu() });
      case 'GET /delivery-zones':
        return send(res, 200, { data: buildZones() });
      case 'POST /orders': {
        if (!session) return fail(res, 401, 'Unauthorized');
        if (session.user.role !== 'cliente')
          return fail(res, 403, 'Forbidden resource');
        if (state.behavior.createOrderStatus !== 0)
          return fail(res, state.behavior.createOrderStatus, 'Error simulado');
        const customer = customers.find((c) => c.id === session.user.id);
        const header = req.headers['idempotency-key'];
        const result = orderStore.create(
          {
            id: session.user.id,
            name: customer?.fullName ?? 'Cliente',
            phone: customer?.phone ?? '+573000000000',
          },
          Array.isArray(header) ? header[0] : header,
          parseJson(body),
        );
        return send(res, result.status, result.body);
      }
      case 'GET /orders': {
        if (!session) return fail(res, 401, 'Unauthorized');
        if (session.user.role !== 'cliente')
          return fail(res, 403, 'Forbidden resource');
        const page = Math.max(1, Number(url.searchParams.get('page') ?? 1));
        const limit = Math.min(
          100,
          Math.max(1, Number(url.searchParams.get('limit') ?? 20)),
        );
        const result = orderStore.list(
          session.user.id,
          page,
          limit,
          url.searchParams.get('status'),
        );
        return send(res, result.status, result.body);
      }
      case 'GET /users':
        if (!session) return fail(res, 401, 'Unauthorized');
        if (session.user.role !== 'admin')
          return fail(res, 403, 'Forbidden resource');
        return send(res, 200, []);
      case 'GET /orders/stream': {
        if (!session) return fail(res, 401, 'Unauthorized');
        if (state.behavior.streamMode === 'live') {
          if (session.user.role !== 'cliente')
            return fail(res, 403, 'Forbidden resource');
          if (state.behavior.streamStatus)
            return fail(res, state.behavior.streamStatus, 'Canal rechazado');
          res.writeHead(200, {
            'content-type': 'text/event-stream',
            'cache-control': 'no-cache',
            connection: 'keep-alive',
          });
          if (state.behavior.streamSilent) {
            req.on('close', () => undefined);
            return;
          }
          const channel = { customerId: session.user.id, kitchen: false, res };
          channels.add(channel);
          res.write('event: ready\ndata: {}\n\n');
          const beat = setInterval(
            () => res.write(': latido\n\n'),
            state.behavior.heartbeatMs,
          );
          req.on('close', () => {
            clearInterval(beat);
            channels.delete(channel);
          });
          return;
        }
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
        });
        res.write('data: 1\n\n');
        const gap = state.behavior.streamGapMs;
        setTimeout(() => res.write('data: 2\n\n'), gap);
        setTimeout(() => {
          res.write('data: 3\n\n');
          res.end();
          state.streamsFinished += 1;
        }, gap * 2);
        return;
      }
      case 'GET /products':
      case 'GET /movements': {
        if (!session) return fail(res, 401, 'Unauthorized');
        if (!isStaff(session.user.role))
          return fail(res, 403, 'Forbidden resource');
        const r =
          route === 'GET /products'
            ? inventory.listProducts(url.searchParams)
            : inventory.listMovements(url.searchParams);
        return send(res, r.status, r.body);
      }
      case 'POST /movements': {
        if (!session) return fail(res, 401, 'Unauthorized');
        if (!isStaff(session.user.role))
          return fail(res, 403, 'Forbidden resource');
        const r = inventory.createMovement(
          { id: session.user.id, username: session.user.username },
          parseJson(body),
        );
        return send(res, r.status, r.body);
      }
      case 'GET /kitchen/orders': {
        if (!session) return fail(res, 401, 'Unauthorized');
        if (!isStaff(session.user.role))
          return fail(res, 403, 'Forbidden resource');
        const wanted = url.searchParams.get('status');
        if (
          wanted !== null &&
          !orderStore.KITCHEN_STATUSES.includes(wanted as OrderStatus)
        )
          return fail(res, 400, 'status inválido');
        const page = Number(url.searchParams.get('page') ?? 1);
        const limit = Number(url.searchParams.get('limit') ?? 20);
        const r = orderStore.listKitchen(
          wanted ? [wanted as OrderStatus] : ['recibido', 'en_preparacion'],
          page,
          limit,
        );
        return send(res, r.status, r.body);
      }
      case 'GET /kitchen/stream': {
        if (!session) return fail(res, 401, 'Unauthorized');
        if (!isStaff(session.user.role))
          return fail(res, 403, 'Forbidden resource');
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        });
        const channel = { customerId: session.user.id, kitchen: true, res };
        channels.add(channel);
        res.write('event: ready\ndata: {}\n\n');
        const beat = setInterval(
          () => res.write(': latido\n\n'),
          state.behavior.heartbeatMs,
        );
        req.on('close', () => {
          clearInterval(beat);
          channels.delete(channel);
        });
        return;
      }
      case 'GET /dispatch/queue': {
        if (!session) return fail(res, 401, 'Unauthorized');
        if (session.user.role !== 'repartidor' && !isStaff(session.user.role))
          return fail(res, 403, 'Forbidden resource');
        const r = dispatch.queue(session.user.id);
        return send(res, r.status, r.body);
      }
      case 'POST /dispatch/rounds': {
        if (!session) return fail(res, 401, 'Unauthorized');
        if (session.user.role !== 'repartidor')
          return fail(res, 403, 'Forbidden resource');
        const r = dispatch.createRound(
          session.user.id,
          body.trim() === '' ? {} : parseJson(body),
        );
        return send(res, r.status, r.body);
      }
      case 'GET /dispatch/rounds': {
        if (!session) return fail(res, 401, 'Unauthorized');
        if (session.user.role !== 'repartidor')
          return fail(res, 403, 'Forbidden resource');
        const r = dispatch.listRounds(session.user.id, url.searchParams);
        return send(res, r.status, r.body);
      }
      case 'GET /dispatch/stream': {
        if (!session) return fail(res, 401, 'Unauthorized');
        if (session.user.role !== 'repartidor')
          return fail(res, 403, 'Forbidden resource');
        res.writeHead(200, {
          'content-type': 'text/event-stream',
          'cache-control': 'no-cache',
          connection: 'keep-alive',
        });
        const channel = { customerId: session.user.id, kitchen: true, res };
        channels.add(channel);
        res.write('event: ready\ndata: {}\n\n');
        const beat = setInterval(
          () => res.write(': latido\n\n'),
          state.behavior.heartbeatMs,
        );
        req.on('close', () => {
          clearInterval(beat);
          channels.delete(channel);
        });
        return;
      }
      default: {
        const dispatchPath = url.pathname.slice(PREFIX.length);
        const roundDetail = /^\/dispatch\/rounds\/([^/]+)$/.exec(dispatchPath);
        const closeOrder = /^\/dispatch\/orders\/([^/]+)\/(deliver|fail)$/.exec(
          dispatchPath,
        );
        if (
          (roundDetail && req.method === 'GET') ||
          (closeOrder && req.method === 'POST')
        ) {
          if (!session) return fail(res, 401, 'Unauthorized');
          if (session.user.role !== 'repartidor')
            return fail(res, 403, 'Forbidden resource');
          const r = roundDetail
            ? dispatch.getRound(session.user.id, roundDetail[1] ?? '')
            : closeOrder?.[2] === 'deliver'
              ? dispatch.deliver(session.user.id, closeOrder[1] ?? '')
              : dispatch.fail(
                  session.user.id,
                  closeOrder?.[1] ?? '',
                  parseJson(body),
                );
          return send(res, r.status, r.body);
        }
        const soldOut = /^\/products\/([^/]+)\/sold-out$/.exec(
          url.pathname.slice(PREFIX.length),
        );
        if (soldOut && req.method === 'PATCH') {
          if (!session) return fail(res, 401, 'Unauthorized');
          if (!isStaff(session.user.role))
            return fail(res, 403, 'Forbidden resource');
          const r = inventory.setSoldOut(soldOut[1] ?? '', parseJson(body));
          return send(res, r.status, r.body);
        }
        const kitchenAction =
          /^\/kitchen\/orders\/([^/]+)\/(start|ready)$/.exec(
            url.pathname.slice(PREFIX.length),
          );
        if (kitchenAction && req.method === 'POST') {
          if (!session) return fail(res, 401, 'Unauthorized');
          if (!isStaff(session.user.role))
            return fail(res, 403, 'Forbidden resource');
          const [, id = '', action] = kitchenAction;
          const r =
            action === 'start'
              ? orderStore.kitchenStart(id)
              : orderStore.kitchenReady(id);
          return send(res, r.status, r.body);
        }
        const detail = /^\/orders\/([^/]+)(\/cancel)?$/.exec(
          url.pathname.slice(PREFIX.length),
        );
        if (detail) {
          if (!session) return fail(res, 401, 'Unauthorized');
          const [, id = '', cancel] = detail;
          if (cancel && req.method === 'POST' && isStaff(session.user.role)) {
            const r = orderStore.cancelStaff(id, parseJson(body)?.reason);
            return send(res, r.status, r.body);
          }
          if (session.user.role !== 'cliente')
            return fail(res, 403, 'Forbidden resource');
          if (cancel && req.method === 'POST') {
            const r = orderStore.cancel(session.user.id, id);
            return send(res, r.status, r.body);
          }
          if (!cancel && req.method === 'GET') {
            const r = orderStore.get(session.user.id, id);
            return send(res, r.status, r.body);
          }
        }
        return fail(res, 404, `Cannot ${req.method} ${url.pathname}`);
      }
    }
  }

  const server = createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) fail(res, 400, 'Solicitud inválida');
      else res.destroy();
    });
  });

  await new Promise<void>((resolve) =>
    server.listen(options.port ?? 0, options.host ?? '127.0.0.1', resolve),
  );
  const { port } = server.address() as AddressInfo;
  state.port = port;
  state.url = `http://${options.host ?? '127.0.0.1'}:${port}${PREFIX}`;
  state.close = () =>
    new Promise<void>((resolve) => {
      server.closeAllConnections();
      server.close(() => resolve());
    });
  return state;
}

if (import.meta.main) {
  const api = await startMockApi({
    port: Number(process.env.MOCK_PORT ?? 4010),
  });
  console.log(`API simulada en ${api.url}`);
}
