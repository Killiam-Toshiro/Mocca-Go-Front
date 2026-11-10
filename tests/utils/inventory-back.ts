import { vi } from 'vitest';
import type { components } from '@/lib/api/schema';
import { backMovement, movementPage, productPage } from './inventory';
import { jsonResponse } from './render';

type Product = components['schemas']['ProductResponse'];
type Movement = components['schemas']['MovementResponse'];

export interface Call {
  method: string;
  url: string;
  body: unknown;
}

/** Un back de inventario falso con estado: catálogo, agotado, movimientos e historial. */
export function fakeInventoryBack(
  initial: Product[],
  opts: {
    movements?: Movement[];
    failMovement?: number | 'network';
    /** Falla solo los movimientos de estos productos (por id). */
    failMovementFor?: Record<string, number | 'network'>;
    failSoldOut?: number | 'network';
  } = {},
) {
  const products = initial.map((p) => ({ ...p }));
  const movements = [...(opts.movements ?? [])];
  const calls: Call[] = [];

  const f = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ method, url, body });
    const path = url.split('?')[0]!;

    if (method === 'GET' && path === '/api/products')
      return jsonResponse(productPage(products));

    const sold = /^\/api\/products\/([^/]+)\/sold-out$/.exec(path);
    if (method === 'PATCH' && sold) {
      if (opts.failSoldOut === 'network') throw new TypeError('network');
      if (opts.failSoldOut)
        return jsonResponse(
          { statusCode: opts.failSoldOut, message: 'Producto no encontrado' },
          opts.failSoldOut,
        );
      const p = products.find((x) => x.id === sold[1]);
      if (!p) return jsonResponse({ statusCode: 404, message: 'x' }, 404);
      p.soldOut = body.soldOut;
      p.available = !p.soldOut && p.active && p.stock > 0;
      return jsonResponse(p);
    }

    if (method === 'POST' && path === '/api/movements') {
      const only = opts.failMovementFor?.[body.productId];
      if (only === 'network') throw new TypeError('network');
      if (only)
        return jsonResponse({ statusCode: only, message: 'Error' }, only);
      if (opts.failMovement === 'network') throw new TypeError('network');
      if (opts.failMovement)
        return jsonResponse(
          {
            statusCode: opts.failMovement,
            message:
              opts.failMovement === 409 ? 'Saldo insuficiente: hay 3' : 'Error',
          },
          opts.failMovement,
        );
      const p = products.find((x) => x.id === body.productId)!;
      p.stock += body.type === 'IN' ? body.quantity : -body.quantity;
      const movement = backMovement({
        productId: p.id,
        type: body.type,
        quantity: body.quantity,
        reason: body.reason,
      });
      movements.unshift(movement);
      return jsonResponse({ movement, stock: p.stock }, 201);
    }

    if (method === 'GET' && path === '/api/movements') {
      const q = new URL(url, 'http://x').searchParams;
      const rows = movements
        .filter((m) => !q.get('type') || m.type === q.get('type'))
        .filter(
          (m) => !q.get('productId') || m.productId === q.get('productId'),
        );
      const limit = Number(q.get('limit') ?? 20);
      const page = Number(q.get('page') ?? 1);
      return jsonResponse(
        movementPage(rows.slice((page - 1) * limit, page * limit), {
          page,
          total: rows.length,
          totalPages: Math.ceil(rows.length / limit),
        }),
      );
    }
    return jsonResponse({ statusCode: 404, message: 'x' }, 404);
  });

  vi.stubGlobal('fetch', f);
  return { calls, products, movements };
}
