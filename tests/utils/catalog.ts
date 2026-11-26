import { vi } from 'vitest';
import { createInventoryStore } from '../mock-api/inventory';
import { buildMenu, type MockMenuItem } from '../mock-api/menu';
import { jsonResponse } from './render';

export type CatalogBehavior =
  | 'ok'
  | 'network'
  /** Se aplica pero la respuesta se pierde. */
  | 'network-saved'
  | { status: number; message: string | string[] };

interface Options {
  post?: CatalogBehavior;
  patch?: CatalogBehavior;
  put?: CatalogBehavior;
  status?: CatalogBehavior;
  del?: CatalogBehavior;
  soldOut?: CatalogBehavior;
  /** Las consultas de lista/recuperación fallan. */
  getFails?: boolean;
}

/** `fetch` del back de productos: usa el almacén del mock (mismas reglas y textos que el back). */
export function fakeCatalogBack(options: Options = {}) {
  const items: MockMenuItem[] = buildMenu();
  const store = createInventoryStore(() => items);
  const state = {
    post: options.post ?? 'ok',
    patch: options.patch ?? 'ok',
    put: options.put ?? 'ok',
    status: options.status ?? 'ok',
    del: options.del ?? 'ok',
    soldOut: options.soldOut ?? 'ok',
    getFails: options.getFails ?? false,
    listDelayMs: 0,
  };
  const calls: { method: string; url: string; body: unknown }[] = [];
  const idOf = (sku: string) => items.find((p) => p.sku === sku)!.id;

  const send = (
    behavior: CatalogBehavior,
    apply: () => { status: number; body: unknown },
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
    return Promise.resolve(
      jsonResponse(r.status === 204 ? null : r.body, r.status),
    );
  };

  const stub = vi.fn((url: string, init?: RequestInit) => {
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : null;
    calls.push({ method, url, body });
    if (url.startsWith('/api/products?') && method === 'GET') {
      if (state.getFails)
        return Promise.resolve(
          jsonResponse({ statusCode: 502, message: 'x' }, 502),
        );
      const respond = () => {
        const r = store.listProducts(new URL(url, 'http://x').searchParams);
        return jsonResponse(r.body, r.status);
      };
      return state.listDelayMs > 0
        ? new Promise<Response>((resolve) =>
            setTimeout(() => resolve(respond()), state.listDelayMs),
          )
        : Promise.resolve(respond());
    }
    if (url === '/api/products' && method === 'POST')
      return send(state.post, () => store.createProduct(body));
    const sub =
      /^\/api\/products\/([^/]+)(\/status|\/components|\/sold-out)?$/.exec(url);
    if (sub) {
      const [, id = '', tail] = sub;
      if (tail === '/status' && method === 'PATCH')
        return send(state.status, () => store.setStatus(id, body));
      if (tail === '/components' && method === 'PUT')
        return send(state.put, () => store.replaceComponents(id, body));
      if (tail === '/sold-out' && method === 'PATCH')
        return send(state.soldOut, () => store.setSoldOut(id, body));
      if (!tail && method === 'PATCH')
        return send(state.patch, () => store.updateProduct(id, body));
      if (!tail && method === 'DELETE')
        return send(state.del, () => store.removeProduct(id));
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
    items,
    idOf,
    lists: () => of('GET', (u) => u.startsWith('/api/products?')),
    posts: () => of('POST', (u) => u === '/api/products'),
    patches: () => of('PATCH', (u) => /^\/api\/products\/[^/]+$/.test(u)),
    puts: () => of('PUT', (u) => u.endsWith('/components')),
    statuses: () => of('PATCH', (u) => u.endsWith('/status')),
    soldOuts: () => of('PATCH', (u) => u.endsWith('/sold-out')),
    deletes: () => of('DELETE', (u) => u.startsWith('/api/products/')),
  };
}
