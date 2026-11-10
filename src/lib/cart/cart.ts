import { z } from 'zod';
import type { MenuItem } from '@/lib/menu/categories';

/** Límites del back para un pedido (`CreateOrderDto`): 1–10 líneas, 1–10 unidades cada una. */
export const MAX_QUANTITY = 10;
export const MAX_LINES = 10;
export const CART_VERSION = 1;

/**
 * Una línea guarda solo lo necesario para recomponerse: el nombre y el último precio
 * visto sirven para mostrar el carrito si el menú no carga y para avisar cambios.
 * El precio, el nombre y la disponibilidad vigentes salen siempre del menú (D-029).
 */
export interface CartLine {
  productId: string;
  name: string;
  quantity: number;
  seenPrice: number;
}
export type Cart = readonly CartLine[];

export const EMPTY_CART: Cart = [];

const lineSchema = z.object({
  productId: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  quantity: z.number().int().min(1).max(MAX_QUANTITY),
  seenPrice: z.number().int().min(0).max(100_000_000),
});
const cartSchema = z.object({
  v: z.literal(CART_VERSION),
  lines: z.array(lineSchema).max(MAX_LINES),
});

export function serializeCart(cart: Cart): string {
  return JSON.stringify({ v: CART_VERSION, lines: cart });
}

/** Lee lo guardado. Cualquier cosa dañada, de otra versión o inconsistente da un carrito vacío. */
export function parseCart(raw: string | null | undefined): Cart {
  if (!raw) return EMPTY_CART;
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return EMPTY_CART;
  }
  const parsed = cartSchema.safeParse(json);
  if (!parsed.success) return EMPTY_CART;
  const ids = new Set(parsed.data.lines.map((line) => line.productId));
  if (ids.size !== parsed.data.lines.length) return EMPTY_CART;
  return parsed.data.lines;
}

export type AddStatus = 'added' | 'increased' | 'max-quantity' | 'max-lines';

export interface AddResult {
  cart: Cart;
  status: AddStatus;
}

/**
 * Suma `quantity` unidades de un producto. Si se pasara de 10 unidades o de 10 productos
 * no se agrega nada (se avisa), según la spec 002.
 */
export function addLine(
  cart: Cart,
  product: Pick<MenuItem, 'id' | 'name' | 'price'>,
  quantity = 1,
): AddResult {
  const amount = Math.floor(quantity);
  if (!Number.isFinite(amount) || amount < 1)
    return { cart, status: 'max-quantity' };
  const existing = cart.find((line) => line.productId === product.id);
  if (existing) {
    if (existing.quantity + amount > MAX_QUANTITY)
      return { cart, status: 'max-quantity' };
    return {
      cart: cart.map((line) =>
        line === existing
          ? {
              ...line,
              quantity: line.quantity + amount,
              seenPrice: product.price,
            }
          : line,
      ),
      status: 'increased',
    };
  }
  if (cart.length >= MAX_LINES) return { cart, status: 'max-lines' };
  if (amount > MAX_QUANTITY) return { cart, status: 'max-quantity' };
  return {
    cart: [
      ...cart,
      {
        productId: product.id,
        name: product.name,
        quantity: amount,
        seenPrice: product.price,
      },
    ],
    status: 'added',
  };
}

/** Fija la cantidad (1–10). Con 0 o menos quita la línea. */
export function setQuantity(
  cart: Cart,
  productId: string,
  quantity: number,
): Cart {
  const amount = Math.floor(quantity);
  if (!Number.isFinite(amount) || amount < 1)
    return removeLine(cart, productId);
  const next = Math.min(amount, MAX_QUANTITY);
  return cart.map((line) =>
    line.productId === productId ? { ...line, quantity: next } : line,
  );
}

export function removeLine(cart: Cart, productId: string): Cart {
  return cart.filter((line) => line.productId !== productId);
}

export type LineStatus = 'ok' | 'agotado' | 'retirado' | 'pendiente';

export interface ReconciledLine {
  line: CartLine;
  /** Producto vigente del menú (`null` si no se conoce). */
  item: MenuItem | null;
  /**
   * `ok`: disponible · `agotado`: está en el menú sin existencias · `retirado`: ya no está ·
   * `pendiente`: el menú aún no cargó, no se sabe.
   */
  status: LineStatus;
  /** Precio vigente (el del menú; si no se conoce, el último visto). */
  unitPrice: number;
  /** El menú trae un precio distinto del que el cliente vio al agregar. */
  priceChanged: boolean;
  /** `unitPrice × cantidad` si está disponible; 0 si no cuenta en el total. */
  lineTotal: number;
}

export interface ReconciledCart {
  rows: ReconciledLine[];
  /** Unidades totales (todas las líneas, para la insignia del botón). */
  units: number;
  /** Suma de los productos disponibles, en pesos enteros. */
  subtotal: number;
  unavailableCount: number;
  priceChangedCount: number;
  /** Se puede seguir al pedido: hay líneas, el menú cargó y todo está disponible. */
  canContinue: boolean;
}

/** Cruza el carrito con el menú vigente (`undefined` = el menú aún no cargó o falló). */
export function reconcile(
  cart: Cart,
  menu: readonly MenuItem[] | undefined,
): ReconciledCart {
  const byId = menu ? new Map(menu.map((item) => [item.id, item])) : null;
  const rows = cart.map((line): ReconciledLine => {
    if (!byId) {
      return {
        line,
        item: null,
        status: 'pendiente',
        unitPrice: line.seenPrice,
        priceChanged: false,
        lineTotal: 0,
      };
    }
    const item = byId.get(line.productId) ?? null;
    if (!item) {
      return {
        line,
        item: null,
        status: 'retirado',
        unitPrice: line.seenPrice,
        priceChanged: false,
        lineTotal: 0,
      };
    }
    const status: LineStatus = item.available ? 'ok' : 'agotado';
    return {
      line,
      item,
      status,
      unitPrice: item.price,
      priceChanged: item.price !== line.seenPrice,
      lineTotal: status === 'ok' ? item.price * line.quantity : 0,
    };
  });
  const unavailableCount = rows.filter((row) => row.status !== 'ok').length;
  return {
    rows,
    units: cart.reduce((sum, line) => sum + line.quantity, 0),
    subtotal: rows.reduce((sum, row) => sum + row.lineTotal, 0),
    unavailableCount,
    priceChangedCount: rows.filter((row) => row.priceChanged).length,
    canContinue: rows.length > 0 && unavailableCount === 0,
  };
}

/** Quita lo que ya no está en el menú y devuelve lo quitado (para avisar). */
export function pruneRetired(
  cart: Cart,
  menu: readonly MenuItem[],
): { cart: Cart; removed: CartLine[] } {
  const ids = new Set(menu.map((item) => item.id));
  const removed = cart.filter((line) => !ids.has(line.productId));
  return {
    cart: removed.length
      ? cart.filter((line) => ids.has(line.productId))
      : cart,
    removed,
  };
}

/** El cliente vio el aviso de precio nuevo: el precio vigente pasa a ser el «visto». */
export function acknowledgePrices(cart: Cart, menu: readonly MenuItem[]): Cart {
  const byId = new Map(menu.map((item) => [item.id, item]));
  let changed = false;
  const next = cart.map((line) => {
    const item = byId.get(line.productId);
    if (!item || item.price === line.seenPrice) return line;
    changed = true;
    return { ...line, seenPrice: item.price };
  });
  return changed ? next : cart;
}
