import { vi } from 'vitest';
import type { Profile } from '@/lib/profile/types';
import { jsonResponse } from './render';

export function profileFixture(over: Partial<Profile> = {}): Profile {
  return {
    id: 'c-1',
    email: 'ana@example.com',
    fullName: 'Ana Pérez',
    phone: '+573001234567',
    createdAt: '2026-11-03T15:00:00.000Z',
    updatedAt: '2026-11-03T15:00:00.000Z',
    ...over,
  };
}

export type PatchBehavior =
  | 'ok'
  | 'network'
  /** Se guarda pero la respuesta se pierde. */
  | 'network-saved'
  | { status: number; message: string | string[] };

/** `fetch` del back para el perfil: `GET/PATCH /api/customers/me` y `PATCH /api/auth/password`. */
export function fakeProfileBack(
  initial: Profile = profileFixture(),
  options: {
    patch?: PatchBehavior;
    password?: PatchBehavior;
    getFails?: boolean;
  } = {},
) {
  const state = {
    profile: initial,
    patch: options.patch ?? 'ok',
    password: options.password ?? 'ok',
    getFails: options.getFails ?? false,
  };
  const calls: { method: string; url: string; body: unknown }[] = [];
  const failure = (b: { status: number; message: string | string[] }) =>
    Promise.resolve(
      jsonResponse({ statusCode: b.status, message: b.message }, b.status),
    );
  const apply = (body: { fullName?: string; phone?: string }) => {
    state.profile = {
      ...state.profile,
      ...(body.fullName ? { fullName: body.fullName } : {}),
      ...(body.phone
        ? { phone: `+57${body.phone.replace(/\D/g, '').slice(-10)}` }
        : {}),
    };
  };
  const stub = vi.fn((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    if (url === '/api/customers/me' && method === 'GET')
      return state.getFails
        ? failure({ status: 502, message: 'x' })
        : Promise.resolve(jsonResponse(state.profile));
    if (url === '/api/customers/me' && method === 'PATCH') {
      const b = state.patch;
      if (b === 'network') return Promise.reject(new TypeError('red caída'));
      if (b === 'network-saved') {
        apply(body);
        return Promise.reject(new TypeError('red caída'));
      }
      if (typeof b === 'object') return failure(b);
      apply(body);
      return Promise.resolve(jsonResponse(state.profile));
    }
    if (url === '/api/auth/password' && method === 'PATCH') {
      const b = state.password;
      if (b === 'network' || b === 'network-saved')
        return Promise.reject(new TypeError('red caída'));
      if (typeof b === 'object') return failure(b);
      return Promise.resolve(new Response(null, { status: 204 }));
    }
    return failure({ status: 404, message: `Sin ruta ${method} ${url}` });
  });
  vi.stubGlobal('fetch', stub);
  const of = (method: string, url: string) =>
    calls.filter((c) => c.method === method && c.url === url);
  return {
    calls,
    state,
    patches: () => of('PATCH', '/api/customers/me'),
    passwords: () => of('PATCH', '/api/auth/password'),
    gets: () => of('GET', '/api/customers/me'),
  };
}
