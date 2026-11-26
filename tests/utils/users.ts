import { vi } from 'vitest';
import type { User } from '@/lib/users/types';
import { jsonResponse } from './render';

export function userFixture(over: Partial<User> = {}): User {
  return {
    id: 'u-1',
    username: 'operador',
    role: 'operador',
    email: null,
    fullName: null,
    phone: null,
    createdAt: '2026-11-01T12:00:00.000Z',
    updatedAt: '2026-11-01T12:00:00.000Z',
    ...over,
  };
}

export const staffFixtures = (): User[] => [
  userFixture({ id: 'u-admin', username: 'admin', role: 'admin' }),
  userFixture({
    id: 'u-rep',
    username: 'repartidor',
    role: 'repartidor',
    fullName: 'Carlos Gómez',
    phone: '+573001234500',
  }),
  userFixture({ id: 'u-op', username: 'operador', role: 'operador' }),
];

export const customerFixture = (over: Partial<User> = {}): User =>
  userFixture({
    id: 'c-1',
    username: 'abcdef0123456789a',
    role: 'cliente',
    email: 'ana.perez@u.icesi',
    fullName: 'Ana Pérez',
    phone: '+573001234567',
    ...over,
  });

export type Behavior =
  | 'ok'
  | 'network'
  /** Se aplica pero la respuesta se pierde. */
  | 'network-saved'
  | { status: number; message: string | string[] };

interface Options {
  post?: Behavior;
  patch?: Behavior;
  role?: Behavior;
  del?: Behavior;
  /** La consulta de recuperación (`GET /api/users`) falla. */
  getFails?: boolean;
}

const norm = (s: string) => s.toLowerCase();

/** `fetch` del back para `/api/users`: lista con `search`/`role`, crear, editar, rol y eliminar. */
export function fakeUsersBack(
  initial: User[] = staffFixtures(),
  options: Options = {},
) {
  const state = {
    users: [...initial],
    post: options.post ?? 'ok',
    patch: options.patch ?? 'ok',
    role: options.role ?? 'ok',
    del: options.del ?? 'ok',
    getFails: options.getFails ?? false,
    /** Retardo de la lista, para ver el estado «cargando». */
    listDelayMs: 0,
  };
  const calls: { method: string; url: string; body: unknown }[] = [];
  const failure = (b: { status: number; message: string | string[] }) =>
    Promise.resolve(
      jsonResponse({ statusCode: b.status, message: b.message }, b.status),
    );

  function list(url: string) {
    const params = new URL(url, 'http://x').searchParams;
    const page = Number(params.get('page') ?? 1);
    const limit = Number(params.get('limit') ?? 20);
    const roles = params.get('role')?.split(',');
    const search = norm(params.get('search') ?? '');
    const rows = state.users
      .filter((u) => !roles || roles.includes(u.role))
      .filter(
        (u) =>
          !search ||
          [u.username, u.fullName, u.phone, u.email].some(
            (f) => f && norm(f).includes(search),
          ),
      )
      .sort((a, b) => a.username.localeCompare(b.username));
    return {
      data: rows.slice((page - 1) * limit, page * limit),
      page,
      limit,
      total: rows.length,
      totalPages: Math.ceil(rows.length / limit),
    };
  }

  const send = <T>(
    behavior: Behavior,
    apply: () => T,
    status = 200,
  ): Promise<Response> => {
    if (behavior === 'network') return Promise.reject(new TypeError('red'));
    if (behavior === 'network-saved') {
      apply();
      return Promise.reject(new TypeError('red'));
    }
    if (typeof behavior === 'object') return failure(behavior);
    const result = apply();
    return Promise.resolve(
      status === 204
        ? new Response(null, { status: 204 })
        : jsonResponse(result, status),
    );
  };

  const stub = vi.fn((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    if (url.startsWith('/api/users?') && method === 'GET') {
      if (state.getFails) return failure({ status: 502, message: 'x' });
      const respond = () => Promise.resolve(jsonResponse(list(url)));
      return state.listDelayMs > 0
        ? new Promise<Response>((resolve) =>
            setTimeout(() => resolve(respond()), state.listDelayMs),
          )
        : respond();
    }
    if (url === '/api/users' && method === 'POST')
      return send(
        state.post,
        () => {
          const created = userFixture({
            id: `u-${body.username}`,
            username: body.username,
            role: body.role,
            fullName: body.fullName ?? null,
            phone: body.phone ?? null,
          });
          state.users.push(created);
          return created;
        },
        201,
      );
    const role = /^\/api\/users\/([^/]+)\/role$/.exec(url);
    if (role && method === 'PATCH')
      return send(state.role, () => {
        const user = state.users.find((u) => u.id === role[1])!;
        user.role = body.role;
        return user;
      });
    const one = /^\/api\/users\/([^/]+)$/.exec(url);
    if (one && method === 'PATCH')
      return send(state.patch, () => {
        const user = state.users.find((u) => u.id === one[1])!;
        for (const key of ['username', 'fullName', 'phone'] as const)
          if (body[key] !== undefined) user[key] = body[key];
        return user;
      });
    if (one && method === 'DELETE')
      return send(
        state.del,
        () => {
          state.users = state.users.filter((u) => u.id !== one[1]);
        },
        204,
      );
    return failure({ status: 404, message: `Sin ruta ${method} ${url}` });
  });
  vi.stubGlobal('fetch', stub);
  const of = (method: string, test: (u: string) => boolean) =>
    calls.filter((c) => c.method === method && test(c.url));
  return {
    calls,
    state,
    lists: () => of('GET', (u) => u.startsWith('/api/users?')),
    posts: () => of('POST', (u) => u === '/api/users'),
    patches: () => of('PATCH', (u) => /^\/api\/users\/[^/]+$/.test(u)),
    roles: () => of('PATCH', (u) => u.endsWith('/role')),
    deletes: () => of('DELETE', (u) => u.startsWith('/api/users/')),
  };
}
