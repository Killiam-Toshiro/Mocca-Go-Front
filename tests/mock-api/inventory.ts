import type { MockMenuItem } from './menu.ts';

type Result = { status: number; body: unknown };
const ok = (status: number, body: unknown): Result => ({ status, body });
const err = (status: number, message: string | string[]): Result => ({
  status,
  body: { statusCode: status, message, error: String(status) },
});

interface Stock {
  stock: number;
  soldOut: boolean;
  active: boolean;
}

export interface MockMovement {
  id: string;
  productId: string;
  type: 'IN' | 'OUT';
  quantity: number;
  reason: string;
  orderId: string | null;
  user: { id: string; username: string };
  createdAt: string;
}

const MAX_STOCK = 100_000;
const INITIAL_STOCK = 50;

const isInt = (v: unknown, min: number, max: number): v is number =>
  typeof v === 'number' && Number.isInteger(v) && v >= min && v <= max;

/**
 * Catálogo con saldo del mock: reproduce `GET /products`, `PATCH /products/:id/sold-out`,
 * `GET/POST /movements` y calcula `available` para el menú público. Los pedidos del mock no
 * descuentan saldo (se verifica contra el back real).
 */
export function createInventoryStore(getBase: () => MockMenuItem[]) {
  const stocks = new Map<string, Stock>();
  const movements: MockMovement[] = [];
  let counter = 0;

  function stockOf(sku: string): Stock {
    let entry = stocks.get(sku);
    if (!entry) {
      entry = { stock: INITIAL_STOCK, soldOut: false, active: true };
      stocks.set(sku, entry);
    }
    return entry;
  }

  const bySku = (sku: string) => getBase().find((p) => p.sku === sku);
  const byName = (name: string) => getBase().find((p) => p.name === name);

  /** Saldo calculado: el propio en un producto simple; el menor de los componentes en un combo. */
  function stockFor(item: MockMenuItem): number {
    if (item.category !== 'combo') return stockOf(item.sku).stock;
    const levels = item.components.map((c) => {
      const part = byName(c.name);
      return part ? Math.floor(stockOf(part.sku).stock / c.quantity) : 0;
    });
    return levels.length === 0 ? 0 : Math.min(...levels);
  }

  function availableFor(item: MockMenuItem): boolean {
    const own = stockOf(item.sku);
    if (!item.available || !own.active || own.soldOut || item.price <= 0)
      return false;
    return stockFor(item) > 0;
  }

  /** Menú público con la disponibilidad calculada. */
  function menu(): MockMenuItem[] {
    return getBase().map((item) => ({
      ...item,
      available: availableFor(item),
    }));
  }

  function product(item: MockMenuItem) {
    const own = stockOf(item.sku);
    const cost = Math.round(item.price * 0.35);
    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      description: item.description,
      category: item.category,
      price: item.price,
      cost,
      costPercent: item.price === 0 ? null : 35,
      soldOut: own.soldOut,
      available: availableFor(item),
      active: own.active,
      stock: stockFor(item),
      components: item.components.map((c) => {
        const part = byName(c.name);
        return {
          productId: part?.id ?? `prod-${c.name.toLowerCase()}`,
          sku: part?.sku ?? c.name.toUpperCase().slice(0, 8),
          name: c.name,
          quantity: c.quantity,
        };
      }),
      createdAt: '2026-11-01T12:00:00.000Z',
      updatedAt: '2026-11-01T12:00:00.000Z',
    };
  }

  function paginate<T>(rows: T[], page: number, limit: number) {
    const totalPages = Math.ceil(rows.length / limit);
    return {
      page,
      limit,
      total: rows.length,
      totalPages,
      data: rows.slice((page - 1) * limit, page * limit),
    };
  }

  const norm = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

  function pageParams(
    pageRaw: string | null,
    limitRaw: string | null,
  ): { page: number; limit: number } | null {
    const page = pageRaw === null ? 1 : Number(pageRaw);
    const limit = limitRaw === null ? 20 : Number(limitRaw);
    return isInt(page, 1, 10_000) && isInt(limit, 1, 100)
      ? { page, limit }
      : null;
  }

  return {
    menu,
    reset() {
      stocks.clear();
      movements.length = 0;
      counter = 0;
    },
    /** Control de pruebas: deja un producto con un saldo exacto. */
    setStock(sku: string, stock: number): boolean {
      if (!bySku(sku)) return false;
      stockOf(sku).stock = stock;
      return true;
    },
    listProducts(query: URLSearchParams): Result {
      const paging = pageParams(query.get('page'), query.get('limit'));
      if (!paging) return err(400, ['page o limit inválidos']);
      const category = query.get('category');
      const active = query.get('active');
      const search = query.get('search');
      if (active !== null && active !== 'true' && active !== 'false')
        return err(400, ['active debe ser true o false']);
      const rows = getBase()
        .filter((p) => category === null || p.category === category)
        .filter(
          (p) => active === null || String(stockOf(p.sku).active) === active,
        )
        .filter(
          (p) =>
            search === null ||
            norm(p.name).includes(norm(search)) ||
            norm(p.sku).includes(norm(search)),
        )
        .sort((a, b) => a.sku.localeCompare(b.sku))
        .map(product);
      return ok(200, paginate(rows, paging.page, paging.limit));
    },
    setSoldOut(id: string, body: Record<string, unknown> | null): Result {
      if (typeof body?.soldOut !== 'boolean')
        return err(400, ['soldOut debe ser booleano']);
      const item = getBase().find((p) => p.id === id);
      if (!item) return err(404, 'Producto no encontrado');
      stockOf(item.sku).soldOut = body.soldOut;
      return ok(200, product(item));
    },
    /** Control de pruebas: desactiva o activa un producto. */
    setActive(sku: string, active: boolean): boolean {
      if (!bySku(sku)) return false;
      stockOf(sku).active = active;
      return true;
    },
    createMovement(
      user: { id: string; username: string },
      body: Record<string, unknown> | null,
    ): Result {
      if (!body) return err(400, ['Cuerpo inválido']);
      const problems: string[] = [];
      if (typeof body.productId !== 'string' || body.productId === '')
        problems.push('productId es obligatorio');
      if (body.type !== 'IN' && body.type !== 'OUT')
        problems.push('type debe ser IN o OUT');
      if (!isInt(body.quantity, 1, 2_147_483_647))
        problems.push('quantity debe ser un entero mayor o igual a 1');
      const reason = body.reason;
      if (
        typeof reason !== 'string' ||
        reason.trim().length < 1 ||
        reason.length > 300 ||
        reason.includes('\u0000')
      )
        problems.push('reason debe tener entre 1 y 300 caracteres');
      if (problems.length > 0) return err(400, problems);

      const item = getBase().find((p) => p.id === body.productId);
      if (!item) return err(404, 'Producto no encontrado');
      if (item.category === 'combo')
        return err(409, 'Un combo no lleva movimientos: su saldo se calcula');
      const own = stockOf(item.sku);
      if (!own.active) return err(409, 'El producto está inactivo');
      const quantity = body.quantity as number;
      if (body.type === 'OUT' && quantity > own.stock)
        return err(409, `Saldo insuficiente: hay ${String(own.stock)}`);
      if (body.type === 'IN' && own.stock + quantity > MAX_STOCK)
        return err(409, `El saldo no puede superar ${String(MAX_STOCK)}`);
      own.stock += body.type === 'IN' ? quantity : -quantity;
      counter += 1;
      const movement: MockMovement = {
        id: `00000000-0000-4000-8000-${String(counter).padStart(12, '0')}`,
        productId: item.id,
        type: body.type as 'IN' | 'OUT',
        quantity,
        reason: (reason as string).trim(),
        orderId: null,
        user,
        createdAt: new Date().toISOString(),
      };
      movements.unshift(movement);
      return ok(201, { movement, stock: own.stock });
    },
    listMovements(query: URLSearchParams): Result {
      const paging = pageParams(query.get('page'), query.get('limit'));
      if (!paging) return err(400, ['page o limit inválidos']);
      const type = query.get('type');
      const productId = query.get('productId');
      if (type !== null && type !== 'IN' && type !== 'OUT')
        return err(400, ['type debe ser IN o OUT']);
      const rows = movements
        .filter((m) => type === null || m.type === type)
        .filter((m) => productId === null || m.productId === productId);
      return ok(200, paginate(rows, paging.page, paging.limit));
    },
  };
}
