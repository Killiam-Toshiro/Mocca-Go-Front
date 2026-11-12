import { vi } from 'vitest';
import { createZonesStore } from '../mock-api/zones';
import { jsonResponse } from './render';

export type ZonesBehavior =
  | 'ok'
  | 'network'
  /** Se aplica pero la respuesta se pierde. */
  | 'network-saved'
  | { status: number; message: string | string[] };

interface Options {
  post?: ZonesBehavior;
  patch?: ZonesBehavior;
  del?: ZonesBehavior;
  /** Puntos con pedidos / zonas con rondas (el back no deja eliminarlos). */
  usedPoints?: string[];
  usedZones?: string[];
  getFails?: boolean;
}

/** `fetch` del back de zonas y puntos: usa el almacén del mock (mismas reglas y textos que el back). */
export function fakeZonesBack(options: Options = {}) {
  const usedPoints = new Set(options.usedPoints ?? []);
  const usedZones = new Set(options.usedZones ?? []);
  const store = createZonesStore({
    usedPoint: (id) => usedPoints.has(id),
    usedZone: (id) => usedZones.has(id),
  });
  const state = {
    post: options.post ?? 'ok',
    patch: options.patch ?? 'ok',
    del: options.del ?? 'ok',
    getFails: options.getFails ?? false,
  };
  const calls: { method: string; url: string; body: unknown }[] = [];

  const send = (
    behavior: ZonesBehavior,
    apply: () => { status: number; body?: unknown },
  ): Promise<Response> => {
    if (behavior === 'network') return Promise.reject(new TypeError('red'));
    if (typeof behavior === 'object')
      return Promise.resolve(
        jsonResponse(
          { statusCode: behavior.status, message: behavior.message },
          behavior.status,
        ),
      );
    const r = apply();
    if (behavior === 'network-saved')
      return Promise.reject(new TypeError('red'));
    return Promise.resolve(jsonResponse(r.body ?? null, r.status));
  };

  const stub = vi.fn((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ method, url, body });
    if (url === '/api/delivery-zones/all' && method === 'GET') {
      if (state.getFails)
        return Promise.resolve(
          jsonResponse({ statusCode: 403, message: 'Forbidden resource' }, 403),
        );
      const r = store.allZones();
      return Promise.resolve(jsonResponse(r.body, r.status));
    }
    if (url === '/api/delivery-zones' && method === 'POST')
      return send(state.post, () => store.createZone(body));
    if (url === '/api/delivery-points' && method === 'POST')
      return send(state.post, () => store.createPoint(body));
    const one = /^\/api\/delivery-(zones|points)\/([^/]+)$/.exec(url);
    if (one) {
      const [, kind, id = ''] = one;
      const zone = kind === 'zones';
      if (method === 'PATCH')
        return send(state.patch, () =>
          zone ? store.updateZone(id, body) : store.updatePoint(id, body),
        );
      if (method === 'DELETE')
        return send(state.del, () =>
          zone ? store.removeZone(id) : store.removePoint(id),
        );
    }
    return Promise.resolve(
      jsonResponse(
        { statusCode: 404, message: `Sin ruta ${method} ${url}` },
        404,
      ),
    );
  });
  vi.stubGlobal('fetch', stub);
  const of = (method: string, test: (u: string) => boolean) =>
    calls.filter((c) => c.method === method && test(c.url));
  return {
    calls,
    state,
    store,
    usedPoints,
    usedZones,
    lists: () => of('GET', (u) => u === '/api/delivery-zones/all'),
    posts: () =>
      of(
        'POST',
        (u) => u === '/api/delivery-zones' || u === '/api/delivery-points',
      ),
    patches: () => of('PATCH', () => true),
    deletes: () => of('DELETE', () => true),
  };
}
