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
  /** Costo de los productos simples cambiados o creados; el resto vale el 35 % del precio. */
  const costs = new Map<string, number>();
  const created = new Map<string, string>();
  let counter = 0;
  let nextProduct = 0;

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

  /** Menú público (RN-37): solo productos activos, con la disponibilidad calculada. */
  function menu(): MockMenuItem[] {
    return getBase()
      .filter((item) => stockOf(item.sku).active)
      .map((item) => ({ ...item, available: availableFor(item) }));
  }

  const unitCost = (item: MockMenuItem): number =>
    costs.get(item.sku) ?? Math.round(item.price * 0.35);

  /** Costo calculado de un combo: suma de `costo × cantidad` de sus componentes. */
  function costFor(item: MockMenuItem): number {
    if (item.category !== 'combo') return unitCost(item);
    return item.components.reduce((sum, c) => {
      const part = byName(c.name);
      return sum + (part ? unitCost(part) * c.quantity : 0);
    }, 0);
  }

  function product(item: MockMenuItem) {
    const own = stockOf(item.sku);
    const cost = costFor(item);
    return {
      id: item.id,
      sku: item.sku,
      name: item.name,
      description: item.description === '' ? null : item.description,
      category: item.category,
      price: item.price,
      cost,
      costPercent:
        item.price <= 0 ? null : Math.round((cost / item.price) * 1000) / 10,
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
      createdAt: created.get(item.sku) ?? '2026-11-01T12:00:00.000Z',
      updatedAt: created.get(item.sku) ?? '2026-11-01T12:00:00.000Z',
    };
  }

  const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,47}$/;
  const CATEGORIES = [
    'combo',
    'cafe',
    'bebida',
    'panaderia',
    'pasteleria',
    'snack',
  ];
  const NOT_FOUND = 'Producto no encontrado.';

  const textProblem = (
    field: string,
    value: unknown,
    min: number,
    max: number,
  ): string | null => {
    if (typeof value !== 'string') return `${field} must be a string`;
    if (value.length < min || value.length > max)
      return `${field} must be longer than or equal to ${String(min)} and shorter than or equal to ${String(max)} characters`;
    if (value.includes('\u0000')) return `${field} contains invalid characters`;
    if (field === 'name' && value.trim() === '')
      return 'name must contain a visible character';
    return null;
  };
  const moneyProblem = (
    field: string,
    value: unknown,
    min: number,
  ): string | null =>
    isInt(value, min, 1_000_000)
      ? null
      : `${field} must be an integer between ${String(min)} and 1000000`;

  function componentsProblem(raw: unknown): string[] {
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > 50)
      return ['components must contain between 1 and 50 elements'];
    const out: string[] = [];
    raw.forEach((c: unknown, i) => {
      const row = c as Record<string, unknown> | null;
      if (typeof row?.productId !== 'string' || row.productId === '')
        out.push(`components.${String(i)}.productId must be a string`);
      if (!isInt(row?.quantity, 1, 10))
        out.push(
          `components.${String(i)}.quantity must be an integer between 1 and 10`,
        );
    });
    return out;
  }

  /** Mismas comprobaciones que `validateComponents` del back; devuelve los productos o el error. */
  function resolveComponents(
    raw: { productId: string; quantity: number }[],
  ): { error: Result } | { parts: { item: MockMenuItem; quantity: number }[] } {
    if (raw.length < 2 || raw.length > 10)
      return { error: err(400, 'Un combo lleva entre 2 y 10 componentes.') };
    if (new Set(raw.map((c) => c.productId)).size !== raw.length)
      return { error: err(400, 'No repitas productos en la composición.') };
    const parts = raw.map((c) => ({
      item: getBase().find((p) => p.id === c.productId),
      quantity: c.quantity,
    }));
    if (parts.some((p) => !p.item))
      return { error: err(400, 'Algún componente no existe.') };
    const found = parts as { item: MockMenuItem; quantity: number }[];
    for (const { item } of [...found].sort((a, b) =>
      a.item.id.localeCompare(b.item.id),
    )) {
      if (item.category === 'combo')
        return {
          error: err(
            400,
            `El componente ${item.sku} es un combo; un combo no contiene combos.`,
          ),
        };
      if (!stockOf(item.sku).active)
        return {
          error: err(400, `El componente ${item.sku} está inactivo.`),
        };
    }
    return { parts: found };
  }

  const isComponentOfCombo = (item: MockMenuItem) =>
    getBase().some((p) => p.components.some((c) => c.name === item.name));

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
      costs.clear();
      created.clear();
      counter = 0;
      nextProduct = 0;
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

    /** `POST /products` (simple o combo) con las reglas y los textos del back. */
    createProduct(body: Record<string, unknown> | null): Result {
      if (!body) return err(400, ['Cuerpo inválido']);
      const problems: string[] = [];
      if (typeof body.sku !== 'string' || !SKU_PATTERN.test(body.sku))
        problems.push(
          'sku must match /^[A-Z0-9][A-Z0-9._-]{0,47}$/ regular expression',
        );
      const nameProblem = textProblem('name', body.name, 1, 120);
      if (nameProblem) problems.push(nameProblem);
      if (body.description !== undefined) {
        const d = textProblem('description', body.description, 1, 500);
        if (d) problems.push(d);
      }
      if (
        typeof body.category !== 'string' ||
        !CATEGORIES.includes(body.category)
      )
        problems.push(`category must be one of: ${CATEGORIES.join(', ')}`);
      if (body.price !== undefined) {
        const m = moneyProblem('price', body.price, 1);
        if (m) problems.push(m);
      }
      if (body.cost !== undefined) {
        const m = moneyProblem('cost', body.cost, 0);
        if (m) problems.push(m);
      }
      if (body.components !== undefined)
        problems.push(...componentsProblem(body.components));
      if (problems.length > 0) return err(400, problems);

      const isCombo = body.category === 'combo';
      let parts: { item: MockMenuItem; quantity: number }[] = [];
      if (isCombo) {
        if (body.cost !== undefined)
          return err(400, 'El costo de un combo se calcula; no lo envíes.');
        if (body.components === undefined)
          return err(400, 'Un combo requiere componentes.');
      } else {
        if (body.components !== undefined)
          return err(400, 'Solo un combo admite componentes.');
        if (body.cost === undefined)
          return err(400, 'El costo es obligatorio.');
        if (body.price === undefined)
          return err(400, 'El precio es obligatorio.');
      }
      if (isCombo) {
        const resolved = resolveComponents(
          body.components as { productId: string; quantity: number }[],
        );
        if ('error' in resolved) return resolved.error;
        parts = resolved.parts;
      }
      if (getBase().some((p) => p.sku === body.sku))
        return err(409, 'El SKU ya existe.');
      let price = body.price as number | undefined;
      if (isCombo) {
        price ??= parts.reduce((sum, p) => sum + p.item.price * p.quantity, 0);
        if (price < 1 || price > 1_000_000)
          return err(
            400,
            'La suma de los componentes no da un precio válido (1 a 1.000.000); indica el precio.',
          );
      }
      nextProduct += 1;
      const sku = body.sku as string;
      const item: MockMenuItem = {
        id: `00000000-0000-4000-9000-${String(nextProduct).padStart(12, '0')}`,
        sku,
        name: body.name as string,
        description: (body.description as string | undefined) ?? '',
        category: body.category as MockMenuItem['category'],
        price: price ?? 0,
        available: true,
        components: parts.map((p) => ({
          name: p.item.name,
          quantity: p.quantity,
        })),
      };
      getBase().push(item);
      stocks.set(sku, { stock: 0, soldOut: false, active: true });
      if (!isCombo) costs.set(sku, body.cost as number);
      created.set(sku, new Date().toISOString());
      return ok(201, product(item));
    },
    /** `PATCH /products/:id`: solo nombre, descripción, categoría, precio y costo. */
    updateProduct(id: string, body: Record<string, unknown> | null): Result {
      if (!body) return err(400, ['Cuerpo inválido']);
      const problems: string[] = [];
      if (body.name !== undefined) {
        const m = textProblem('name', body.name, 1, 120);
        if (m) problems.push(m);
      }
      if (body.description !== undefined && body.description !== null) {
        const m = textProblem('description', body.description, 1, 500);
        if (m) problems.push(m);
      }
      if (
        body.category !== undefined &&
        (typeof body.category !== 'string' ||
          !CATEGORIES.includes(body.category))
      )
        problems.push(`category must be one of: ${CATEGORIES.join(', ')}`);
      if (body.price !== undefined) {
        const m = moneyProblem('price', body.price, 1);
        if (m) problems.push(m);
      }
      if (body.cost !== undefined) {
        const m = moneyProblem('cost', body.cost, 0);
        if (m) problems.push(m);
      }
      if (problems.length > 0) return err(400, problems);
      if (
        ['name', 'description', 'category', 'price', 'cost'].every(
          (k) => body[k] === undefined,
        )
      )
        return err(400, 'Indica al menos un campo para editar.');
      const item = getBase().find((p) => p.id === id);
      if (!item) return err(404, NOT_FOUND);
      const isCombo = item.category === 'combo';
      if (isCombo && body.cost !== undefined)
        return err(400, 'El costo de un combo se calcula; no lo envíes.');
      if (
        body.category !== undefined &&
        (body.category === 'combo') !== isCombo
      )
        return err(
          400,
          'Un producto no se convierte en combo ni a la inversa.',
        );
      if (typeof body.name === 'string' && body.name !== item.name) {
        for (const other of getBase())
          for (const c of other.components)
            if (c.name === item.name) c.name = body.name;
        item.name = body.name;
      }
      if (body.description !== undefined)
        item.description = (body.description as string | null) ?? '';
      if (typeof body.category === 'string')
        item.category = body.category as MockMenuItem['category'];
      if (typeof body.price === 'number') item.price = body.price;
      if (typeof body.cost === 'number') costs.set(item.sku, body.cost);
      return ok(200, product(item));
    },
    /** `PATCH /products/:id/status`. */
    setStatus(id: string, body: Record<string, unknown> | null): Result {
      if (typeof body?.active !== 'boolean')
        return err(400, ['active must be a boolean value']);
      const item = getBase().find((p) => p.id === id);
      if (!item) return err(404, NOT_FOUND);
      stockOf(item.sku).active = body.active;
      return ok(200, product(item));
    },
    /** `PUT /products/:id/components`: reemplaza la composición; no toca el precio. */
    replaceComponents(
      id: string,
      body: Record<string, unknown> | null,
    ): Result {
      const problems = componentsProblem(body?.components);
      if (problems.length > 0) return err(400, problems);
      const item = getBase().find((p) => p.id === id);
      if (!item) return err(404, NOT_FOUND);
      if (item.category !== 'combo')
        return err(409, 'El producto no es un combo.');
      const resolved = resolveComponents(
        body?.components as { productId: string; quantity: number }[],
      );
      if ('error' in resolved) return resolved.error;
      item.components = resolved.parts.map((p) => ({
        name: p.item.name,
        quantity: p.quantity,
      }));
      return ok(200, product(item));
    },
    /** `DELETE /products/:id`: sin movimientos y sin ser componente de un combo. */
    removeProduct(id: string): Result {
      const base = getBase();
      const index = base.findIndex((p) => p.id === id);
      const item = base[index];
      if (!item) return err(404, NOT_FOUND);
      if (isComponentOfCombo(item))
        return err(409, 'El producto es componente de un combo.');
      if (movements.some((m) => m.productId === id))
        return err(
          409,
          'El producto tiene movimientos; desactívalo con PATCH /products/:id/status.',
        );
      base.splice(index, 1);
      stocks.delete(item.sku);
      costs.delete(item.sku);
      return { status: 204, body: undefined };
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
