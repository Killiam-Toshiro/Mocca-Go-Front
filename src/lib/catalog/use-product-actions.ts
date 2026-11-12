'use client';

import { requestJson } from '@/lib/api/json';
import type { CreateProductBody, UpdateBody } from './schemas';
import type { Product } from './types';
import { findBySku } from './use-catalog';
import { useCatalogAction, type ActionHandlers } from './use-catalog-action';

const post = <R>(url: string, method: string, body?: unknown) =>
  requestJson<R>(url, { method, body, handleUnauthorized: true });

/** `POST /products`; si la respuesta se perdió, se busca el SKU y, si existe, se da por creado. */
export function useCreateProduct(handlers?: ActionHandlers<Product>) {
  return useCatalogAction<CreateProductBody, Product>(
    (body) => post<Product>('/api/products', 'POST', body),
    async (body) => {
      const found = await findBySku(body.sku);
      return found ? { found } : null;
    },
    handlers,
  );
}

/** `PATCH /products/{id}`: recupera comparando lo enviado con lo que quedó guardado. */
export function useUpdateProduct(handlers?: ActionHandlers<Product>) {
  return useCatalogAction<{ product: Product; body: UpdateBody }, Product>(
    ({ product, body }) =>
      post<Product>(`/api/products/${product.id}`, 'PATCH', body),
    async ({ product, body }) => {
      const found = await findBySku(product.sku);
      if (!found) return null;
      const same =
        (body.name === undefined || found.name === body.name) &&
        (body.description === undefined ||
          found.description === body.description) &&
        (body.category === undefined || found.category === body.category) &&
        (body.price === undefined || found.price === body.price) &&
        (body.cost === undefined || found.cost === body.cost);
      return same ? { found } : null;
    },
    handlers,
  );
}

/** `PUT /products/{id}/components`: reemplaza toda la composición; no cambia el precio. */
export function useReplaceComponents(handlers?: ActionHandlers<Product>) {
  return useCatalogAction<
    { product: Product; components: { productId: string; quantity: number }[] },
    Product
  >(
    ({ product, components }) =>
      post<Product>(`/api/products/${product.id}/components`, 'PUT', {
        components,
      }),
    async ({ product, components }) => {
      const found = await findBySku(product.sku);
      if (!found || found.components.length !== components.length) return null;
      const same = components.every((c) =>
        found.components.some(
          (f) => f.productId === c.productId && f.quantity === c.quantity,
        ),
      );
      return same ? { found } : null;
    },
    handlers,
  );
}

/** `PATCH /products/{id}/status`. */
export function useSetStatus(handlers?: ActionHandlers<Product>) {
  return useCatalogAction<{ product: Product; active: boolean }, Product>(
    ({ product, active }) =>
      post<Product>(`/api/products/${product.id}/status`, 'PATCH', { active }),
    async ({ product, active }) => {
      const found = await findBySku(product.sku);
      return found && found.active === active ? { found } : null;
    },
    handlers,
  );
}

/** `DELETE /products/{id}` (204): tras un corte, si el SKU ya no aparece se da por eliminado. */
export function useDeleteProduct(handlers?: ActionHandlers<null>) {
  return useCatalogAction<Product, null>(
    async (product) => {
      await post(`/api/products/${product.id}`, 'DELETE');
      return null;
    },
    async (product) =>
      (await findBySku(product.sku)) ? null : { found: null },
    handlers,
  );
}

/** `PATCH /products/{id}/sold-out` (idempotente, sin recuperación: se puede repetir). */
export function useCatalogSoldOut(handlers?: ActionHandlers<Product>) {
  return useCatalogAction<{ product: Product; soldOut: boolean }, Product>(
    ({ product, soldOut }) =>
      post<Product>(`/api/products/${product.id}/sold-out`, 'PATCH', {
        soldOut,
      }),
    null,
    handlers,
  );
}
