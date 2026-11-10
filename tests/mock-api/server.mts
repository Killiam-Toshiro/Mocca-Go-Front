/**
 * API simulada del back de Mocca Go para pruebas de integración y E2E.
 * Solo usa sintaxis que Node 24 ejecuta sin transpilar.
 *
 * Usuarios (contraseña MOCK_PASSWORD): admin, operador, repartidor, cliente@example.com,
 * y `corta` (operador cuya sesión dura 3 s). Casos especiales:
 *   - login con `limitado` → 429
 *   - registro con `ocupado@example.com` → 409; con `limitado@example.com` → 429
 *   - GET /menu respeta behavior.menuDelayMs (ruta lenta)
 *   - behavior.failMe hace que GET /auth/me responda 500
 *   - GET /orders/stream emite 3 fragmentos separados por behavior.streamGapMs
 */
import { createHash } from 'node:crypto';
import { createServer } from 'node:http';
import type {
  IncomingHttpHeaders,
  IncomingMessage,
  ServerResponse,
} from 'node:http';
import type { AddressInfo } from 'node:net';

export const MOCK_PASSWORD = 'Password-123456';
const PREFIX = '/api/v1';

type Role = 'admin' | 'operador' | 'repartidor' | 'cliente';
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
  behavior: { menuDelayMs: number; streamGapMs: number; failMe: boolean };
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

  const state: MockApi = {
    url: '',
    port: 0,
    requests: [],
    behavior: { menuDelayMs: 0, streamGapMs: 150, failMe: false },
    streamsFinished: 0,
    reset() {
      state.requests.length = 0;
      state.behavior.menuDelayMs = 0;
      state.behavior.streamGapMs = 150;
      state.behavior.failMe = false;
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
        return send(res, 200, []);
      case 'GET /users':
        if (!session) return fail(res, 401, 'Unauthorized');
        if (session.user.role !== 'admin')
          return fail(res, 403, 'Forbidden resource');
        return send(res, 200, []);
      case 'GET /orders/stream': {
        if (!session) return fail(res, 401, 'Unauthorized');
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
      default:
        return fail(res, 404, `Cannot ${req.method} ${url.pathname}`);
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
