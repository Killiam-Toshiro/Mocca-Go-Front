import { z } from 'zod';
import type { Product, SimpleCategory } from './types';

/** Mismos límites que el back; su mensaje sigue siendo la autoridad. */
export const SKU_PATTERN = /^[A-Z0-9][A-Z0-9._-]{0,47}$/;
export const MAX_MONEY = 1_000_000;
export const NAME_MAX = 120;
export const DESCRIPTION_MAX = 500;
export const MIN_COMPONENTS = 2;
export const MAX_COMPONENTS = 10;
export const MAX_QUANTITY = 10;

export const SKU_MESSAGE =
  'Usa letras mayúsculas, números, punto, guion o guion bajo (máximo 48), empezando por letra o número.';
const NAME_MESSAGE = `El nombre debe tener entre 1 y ${NAME_MAX} caracteres.`;
const DESCRIPTION_MESSAGE = `La descripción puede tener hasta ${DESCRIPTION_MAX} caracteres.`;
export const PRICE_MESSAGE = 'El precio es un número entero de 1 a 1.000.000.';
export const COST_MESSAGE = 'El costo es un número entero de 0 a 1.000.000.';
export const COMPONENTS_MESSAGE = `Un combo lleva entre ${MIN_COMPONENTS} y ${MAX_COMPONENTS} productos distintos.`;

/** Componente elegido: guarda precio y costo para calcular la suma en pantalla. */
export interface ComponentPick {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  price: number;
  cost: number;
}

export interface ProductFormValues {
  kind: 'producto' | 'combo';
  sku: string;
  name: string;
  description: string;
  category: SimpleCategory;
  /** Texto del campo; en un combo puede quedar vacío (el back usa la suma). */
  price: string;
  cost: string;
  components: ComponentPick[];
}

/** Entero escrito solo con dígitos; cualquier otra cosa da `null`. */
export function parseMoney(text: string): number | null {
  const value = text.trim();
  return /^\d{1,9}$/.test(value) ? Number(value) : null;
}

const moneyOk = (text: string, min: number): boolean => {
  const n = parseMoney(text);
  return n !== null && n >= min && n <= MAX_MONEY;
};

/** Suma de precios y costo de una composición (lo que calcularía el back al crearla). */
export function comboTotals(components: readonly ComponentPick[]): {
  price: number;
  cost: number;
} {
  return components.reduce(
    (t, c) => ({
      price: t.price + c.price * c.quantity,
      cost: t.cost + c.cost * c.quantity,
    }),
    { price: 0, cost: 0 },
  );
}

export const productSchema = z
  .object({
    kind: z.enum(['producto', 'combo']),
    sku: z.string().trim().regex(SKU_PATTERN, SKU_MESSAGE),
    name: z.string().trim().min(1, NAME_MESSAGE).max(NAME_MAX, NAME_MESSAGE),
    description: z.string().trim().max(DESCRIPTION_MAX, DESCRIPTION_MESSAGE),
    category: z.enum(['cafe', 'bebida', 'panaderia', 'pasteleria', 'snack']),
    price: z.string(),
    cost: z.string(),
    components: z.array(z.custom<ComponentPick>()),
  })
  .superRefine((v, ctx) => {
    const combo = v.kind === 'combo';
    if (combo) {
      if (v.price.trim() !== '' && !moneyOk(v.price, 1))
        ctx.addIssue({
          code: 'custom',
          path: ['price'],
          message: PRICE_MESSAGE,
        });
      const n = v.components.length;
      const ids = new Set(v.components.map((c) => c.productId));
      if (
        n < MIN_COMPONENTS ||
        n > MAX_COMPONENTS ||
        ids.size !== n ||
        v.components.some(
          (c) =>
            !Number.isInteger(c.quantity) ||
            c.quantity < 1 ||
            c.quantity > MAX_QUANTITY,
        )
      )
        ctx.addIssue({
          code: 'custom',
          path: ['components'],
          message: COMPONENTS_MESSAGE,
        });
      return;
    }
    if (!moneyOk(v.price, 1))
      ctx.addIssue({ code: 'custom', path: ['price'], message: PRICE_MESSAGE });
    if (!moneyOk(v.cost, 0))
      ctx.addIssue({ code: 'custom', path: ['cost'], message: COST_MESSAGE });
  });

export interface CreateProductBody {
  sku: string;
  name: string;
  description?: string;
  category: string;
  price?: number;
  cost?: number;
  components?: { productId: string; quantity: number }[];
}

/** Cuerpo de `POST /products`: un combo no lleva `cost`; sin precio, el back usa la suma. */
export function createBody(v: ProductFormValues): CreateProductBody {
  const body: CreateProductBody = {
    sku: v.sku.trim(),
    name: v.name.trim(),
    category: v.kind === 'combo' ? 'combo' : v.category,
  };
  if (v.description.trim()) body.description = v.description.trim();
  if (v.kind === 'combo') {
    body.components = v.components.map((c) => ({
      productId: c.productId,
      quantity: c.quantity,
    }));
    const price = parseMoney(v.price);
    if (v.price.trim() !== '' && price !== null) body.price = price;
  } else {
    body.price = parseMoney(v.price) ?? 0;
    body.cost = parseMoney(v.cost) ?? 0;
  }
  return body;
}

export interface EditValues {
  name: string;
  description: string;
  category: SimpleCategory;
  price: string;
  cost: string;
}

export const editValuesOf = (p: Product): EditValues => ({
  name: p.name,
  description: p.description ?? '',
  category: (p.category === 'combo' ? 'cafe' : p.category) as SimpleCategory,
  price: String(p.price),
  cost: String(p.cost),
});

export const editSchema = (p: Product) =>
  z
    .object({
      name: z.string().trim().min(1, NAME_MESSAGE).max(NAME_MAX, NAME_MESSAGE),
      description: z.string().trim().max(DESCRIPTION_MAX, DESCRIPTION_MESSAGE),
      category: z.enum(['cafe', 'bebida', 'panaderia', 'pasteleria', 'snack']),
      price: z.string(),
      cost: z.string(),
    })
    .superRefine((v, ctx) => {
      if (!moneyOk(v.price, 1))
        ctx.addIssue({
          code: 'custom',
          path: ['price'],
          message: PRICE_MESSAGE,
        });
      if (p.category !== 'combo' && !moneyOk(v.cost, 0))
        ctx.addIssue({ code: 'custom', path: ['cost'], message: COST_MESSAGE });
    });

export interface UpdateBody {
  name?: string;
  description?: string | null;
  category?: SimpleCategory;
  price?: number;
  cost?: number;
}

/** Solo lo modificado; descripción vacía = `null` (la borra). Un combo no envía costo ni categoría. */
export function changedFields(original: Product, v: EditValues): UpdateBody {
  const body: UpdateBody = {};
  const combo = original.category === 'combo';
  if (v.name.trim() !== original.name) body.name = v.name.trim();
  const description = v.description.trim();
  if (description !== (original.description ?? ''))
    body.description = description === '' ? null : description;
  if (!combo && v.category !== original.category) body.category = v.category;
  const price = parseMoney(v.price);
  if (price !== null && price !== original.price) body.price = price;
  const cost = parseMoney(v.cost);
  if (!combo && cost !== null && cost !== original.cost) body.cost = cost;
  return body;
}

export const hasChanges = (body: UpdateBody): boolean =>
  Object.keys(body).length > 0;

/** Margen en texto: «35,6 % del precio» (coma decimal). */
export function formatCostPercent(percent: number | null): string {
  if (percent === null) return 'sin margen calculable';
  return `${String(percent).replace('.', ',')} % del precio`;
}
