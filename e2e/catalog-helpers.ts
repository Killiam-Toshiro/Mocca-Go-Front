import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { adminToken, API, uid } from './users-helpers';

export interface MockProduct {
  id: string;
  sku: string;
  name: string;
  price: number;
  cost: number;
  active: boolean;
  category: string;
}

/** SKU y nombre únicos: los dos proyectos (escritorio y 360 px) comparten el mismo mock. */
export function unique(prefix = 'E2E') {
  const id = uid();
  return { sku: `${prefix}-${id}`.toUpperCase(), name: `Prueba ${id}`, id };
}

const headers = (token: string) => ({ authorization: `Bearer ${token}` });

export async function createProduct(
  request: APIRequestContext,
  over: Partial<{
    sku: string;
    name: string;
    price: number;
    cost: number;
  }> = {},
): Promise<MockProduct> {
  const token = await adminToken(request);
  const u = unique();
  const res = await request.post(`${API}/products`, {
    headers: headers(token),
    data: {
      sku: over.sku ?? u.sku,
      name: over.name ?? u.name,
      category: 'snack',
      price: over.price ?? 3000,
      cost: over.cost ?? 1000,
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as MockProduct;
}

export async function createCombo(
  request: APIRequestContext,
  parts: { id: string; quantity?: number }[],
  over: Partial<{ sku: string; name: string; price: number }> = {},
): Promise<MockProduct> {
  const token = await adminToken(request);
  const u = unique('CMB');
  const res = await request.post(`${API}/products`, {
    headers: headers(token),
    data: {
      sku: over.sku ?? u.sku,
      name: over.name ?? `Combo ${u.id}`,
      category: 'combo',
      components: parts.map((p) => ({
        productId: p.id,
        quantity: p.quantity ?? 1,
      })),
      ...(over.price ? { price: over.price } : {}),
    },
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as MockProduct;
}

/** Elimina lo creado (combos primero); ignora lo que ya no se pueda borrar. */
export async function cleanup(
  request: APIRequestContext,
  products: { id: string; sku: string }[],
): Promise<void> {
  const token = await adminToken(request);
  const ordered = [...products].sort((a, b) =>
    a.sku.startsWith('CMB') === b.sku.startsWith('CMB')
      ? 0
      : a.sku.startsWith('CMB')
        ? -1
        : 1,
  );
  for (const p of ordered) {
    const res = await request.delete(`${API}/products/${p.id}`, {
      headers: headers(token),
    });
    if (res.status() === 409)
      await request.patch(`${API}/products/${p.id}/status`, {
        headers: headers(token),
        data: { active: false },
      });
  }
}

export async function openCatalog(page: Page): Promise<void> {
  await page.goto('/admin/catalogo');
  await expect(
    page.getByRole('heading', { name: 'Catálogo', level: 1 }),
  ).toBeVisible();
}

/** Busca un SKU y espera a que el servidor responda con una sola coincidencia. */
export async function findInCatalog(page: Page, text: string): Promise<void> {
  await page.getByLabel('Buscar producto').fill(text);
  await expect(page.getByText('1 resultado', { exact: true })).toBeVisible();
}

export const rowOf = (page: Page, text: string) =>
  page
    .getByRole('list', { name: 'Catálogo' })
    .getByRole('listitem')
    .filter({ hasText: text });
