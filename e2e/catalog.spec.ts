import { expect, test, type Page } from '@playwright/test';
import { login, newCustomerSession } from './helpers';
import {
  cleanup,
  createCombo,
  createProduct,
  findInCatalog,
  openCatalog,
  rowOf,
  unique,
  type MockProduct,
} from './catalog-helpers';
import { adminToken, API } from './users-helpers';

const dialog = (page: Page) => page.getByRole('dialog');
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

async function adminOn(page: Page) {
  await login(page, 'admin', '/admin');
  await openCatalog(page);
}

test.describe('catálogo', () => {
  const made: MockProduct[] = [];
  test.afterEach(async ({ request }) => {
    await cleanup(request, made.splice(0));
  });

  test('guardas: visitante al login, otros roles a su panel; el admin ve «Catálogo» (CA-01)', async ({
    page,
  }) => {
    await page.goto('/admin/catalogo');
    await expect(page).toHaveURL(/\/login/);
    await login(page, 'operador', /\/operador$/);
    await page.goto('/admin/catalogo');
    await expect(page).toHaveURL(/\/operador$/);
    await page.context().clearCookies();
    await login(page, 'admin', '/admin');
    await page.goto('/admin');
    const menu = page.getByRole('button', { name: 'Abrir menú' });
    if (await menu.isVisible()) await menu.click();
    await expect(
      page.getByRole('link', { name: 'Catálogo' }).first(),
    ).toBeVisible();
  });

  test('lista, busca y filtra desde el servidor con paginación (CA-02, CA-03)', async ({
    page,
  }) => {
    await adminOn(page);
    await expect(page.getByText(/^\d+ resultados$/)).toBeVisible();
    await expect(
      page.getByRole('navigation', { name: 'Páginas del catálogo' }),
    ).toBeVisible();
    await page.getByLabel('Buscar producto').fill('CMB-');
    await expect(
      page.getByText(/^[3-9]\d* resultados$|^[1-9]\d+ resultados$/),
    ).toBeVisible();
    await page.getByLabel('Buscar producto').fill('');
    await page.getByLabel('Categoría').selectOption('combo');
    await expect(rowOf(page, 'Combo Clásico')).toBeVisible();
    await expect(rowOf(page, 'Espresso')).toHaveCount(0);
    await expect(
      rowOf(page, 'Combo Clásico').getByText(/Costo \$/),
    ).toBeVisible();
    await page.getByLabel('Estado').selectOption('inactivos');
    // Solo inactivos (puede haber restos de otras pruebas): ninguna fila «Disponible».
    await expect(page.getByText(/^\d+ resultados?$/)).toBeVisible();
    await expect(
      page.getByRole('list', { name: 'Catálogo' }).getByText('Disponible'),
    ).toHaveCount(0);
  });

  test('crea un producto y el cliente y el operador lo ven (CA-04, CA-11)', async ({
    page,
    browser,
    request,
  }) => {
    const u = unique();
    await adminOn(page);
    await page.getByRole('button', { name: 'Crear producto' }).click();
    const d = dialog(page);
    await d.getByLabel('SKU').fill(u.sku.toLowerCase());
    await expect(d.getByLabel('SKU')).toHaveValue(u.sku);
    await d.getByLabel('Nombre').fill(u.name);
    await d.getByLabel('Categoría').selectOption('snack');
    await d.getByLabel('Precio').fill('3200');
    await d.getByLabel('Costo').fill('1100');
    await d.getByRole('button', { name: 'Crear producto' }).click();
    await expect(page.getByText(`Producto ${u.name} creado.`)).toBeVisible();
    await findInCatalog(page, u.sku);
    const row = rowOf(page, u.name);
    await expect(row.getByText('$3.200')).toBeVisible();
    await expect(
      row.getByText(/Costo \$1\.100 · 34,4 % del precio/),
    ).toBeVisible();
    const token = await adminToken(request);
    const found = await request.get(`${API}/products?search=${u.sku}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    const [created] = ((await found.json()) as { data: MockProduct[] }).data;
    made.push(created!);

    const customer = await browser.newContext();
    const customerPage = await customer.newPage();
    await newCustomerSession(customerPage);
    await customerPage.goto('/cliente/menu');
    await expect(customerPage.getByText(u.name).first()).toBeVisible();
    await customer.close();

    const op = await browser.newContext();
    const opPage = await op.newPage();
    await login(opPage, 'operador', /\/operador$/);
    await opPage.goto('/operador/productos');
    await opPage.getByLabel('Buscar producto').fill(u.sku);
    await expect(
      opPage.getByRole('heading', { name: u.name, level: 3 }),
    ).toBeVisible();
    await op.close();
  });

  test('un SKU repetido se explica bajo el campo y no se crea (CA-04)', async ({
    page,
  }) => {
    await adminOn(page);
    await page.getByRole('button', { name: 'Crear producto' }).click();
    const d = dialog(page);
    await d.getByLabel('SKU').fill('CAF-ESPR');
    await d.getByLabel('Nombre').fill('Repetido');
    await d.getByLabel('Precio').fill('1000');
    await d.getByLabel('Costo').fill('100');
    await d.getByRole('button', { name: 'Crear producto' }).click();
    await expect(d.getByText('El SKU ya existe.')).toBeVisible();
    await expect(d.getByLabel('SKU')).toHaveAttribute('aria-invalid', 'true');
  });

  test('crea un combo: suma y costo en vivo, precio por defecto y composición en la fila (CA-05)', async ({
    page,
  }) => {
    const a = await createProduct(page.request, { price: 3000, cost: 1000 });
    const b = await createProduct(page.request, { price: 2000, cost: 500 });
    made.push(a, b);
    const u = unique('CMB');
    await adminOn(page);
    await page.getByRole('button', { name: 'Crear producto' }).click();
    const d = dialog(page);
    await d.getByLabel('Tipo').selectOption('combo');
    await expect(d.getByLabel('Costo')).toHaveCount(0);
    await d.getByLabel('SKU').fill(u.sku);
    await d.getByLabel('Nombre').fill(`Combo ${u.id}`);
    await d.getByLabel('Buscar componente').fill(a.sku);
    await d.getByRole('button', { name: `Agregar ${a.name}` }).click();
    await d.getByLabel('Buscar componente').fill(b.sku);
    await d.getByRole('button', { name: `Agregar ${b.name}` }).click();
    await d.getByLabel(`Cantidad de ${b.name}`).selectOption('2');
    await expect(
      d.getByText('Suma de precios $7.000 · Costo calculado $2.000'),
    ).toBeVisible();
    await d.getByRole('button', { name: 'Crear combo' }).click();
    await expect(page.getByText(`Combo Combo ${u.id} creado.`)).toBeVisible();
    await findInCatalog(page, u.sku);
    const row = rowOf(page, `Combo ${u.id}`);
    await expect(row.getByText('$7.000')).toBeVisible();
    await expect(
      row.getByText(new RegExp(`1 × ${a.name}, 2 × ${b.name}`)),
    ).toBeVisible();
    const token = await adminToken(page.request);
    const found = await page.request.get(`${API}/products?search=${u.sku}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    made.push(...((await found.json()) as { data: MockProduct[] }).data);
  });

  test('edita precio y descripción, y recompone un combo sin que cambie su precio (CA-06, CA-07)', async ({
    page,
  }) => {
    const a = await createProduct(page.request, { price: 3000, cost: 1000 });
    const b = await createProduct(page.request, { price: 2000, cost: 500 });
    const c = await createProduct(page.request, { price: 1500, cost: 400 });
    const combo = await createCombo(
      page.request,
      [{ id: a.id }, { id: b.id }],
      {
        price: 4800,
      },
    );
    made.push(a, b, c, combo);
    await adminOn(page);
    await findInCatalog(page, combo.sku);
    await page.getByRole('button', { name: `Editar ${combo.name}` }).click();
    const d = dialog(page);
    await d.getByLabel('Precio').fill('5000');
    await d.getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(d.getByText(/Precio actual \$5\.000/)).toBeVisible();
    await d.getByRole('button', { name: `Quitar ${b.name}` }).click();
    await d.getByLabel('Buscar componente').fill(c.sku);
    await d.getByRole('button', { name: `Agregar ${c.name}` }).click();
    await d.getByRole('button', { name: 'Guardar composición' }).click();
    await expect(
      d.getByText(/Precio actual \$5\.000 · suma de componentes \$4\.500/),
    ).toBeVisible();
    await d.getByRole('button', { name: 'Cerrar' }).click();
    await expect(rowOf(page, combo.name).getByText('$5.000')).toBeVisible();
    await expect(
      rowOf(page, combo.name).getByText(new RegExp(c.name)),
    ).toBeVisible();
  });

  test('un componente inactivo se explica con el texto del back y la composición no cambia (CA-07)', async ({
    page,
  }) => {
    const a = await createProduct(page.request);
    const b = await createProduct(page.request);
    const dead = await createProduct(page.request);
    const combo = await createCombo(page.request, [{ id: a.id }, { id: b.id }]);
    made.push(a, b, dead, combo);
    const token = await adminToken(page.request);
    await page.request.patch(`${API}/products/${dead.id}/status`, {
      headers: { authorization: `Bearer ${token}` },
      data: { active: false },
    });
    await adminOn(page);
    await findInCatalog(page, combo.sku);
    await page.getByRole('button', { name: `Editar ${combo.name}` }).click();
    const d = dialog(page);
    // El inactivo no se ofrece; se fuerza por la API para ver el texto del back.
    await d.getByLabel('Buscar componente').fill(dead.sku);
    await expect(
      d.getByText(/No hay productos simples y activos/),
    ).toBeVisible();
    const res = await page.request.put(
      `${API}/products/${combo.id}/components`,
      {
        headers: { authorization: `Bearer ${token}` },
        data: {
          components: [
            { productId: a.id, quantity: 1 },
            { productId: dead.id, quantity: 1 },
          ],
        },
      },
    );
    expect(res.status()).toBe(400);
    expect(JSON.stringify(await res.json())).toContain(
      `El componente ${dead.sku} está inactivo.`,
    );
  });

  test('desactivar y activar piden confirmación y avisan de los combos afectados (CA-08)', async ({
    page,
  }) => {
    const a = await createProduct(page.request);
    const b = await createProduct(page.request);
    const combo = await createCombo(page.request, [{ id: a.id }, { id: b.id }]);
    made.push(a, b, combo);
    await adminOn(page);
    await findInCatalog(page, a.sku);
    const row = rowOf(page, a.name);
    await row.getByRole('button', { name: `Desactivar ${a.name}` }).click();
    await expect(
      row.getByText(new RegExp(`Es componente de .*${combo.name}`)),
    ).toBeVisible();
    await row.getByRole('button', { name: 'Cancelar' }).click();
    await expect(row.getByText('Activo', { exact: true })).toHaveCount(0);
    await row.getByRole('button', { name: `Desactivar ${a.name}` }).click();
    await row.getByRole('button', { name: 'Sí, desactivar' }).click();
    await expect(page.getByText(`${a.name} está inactivo.`)).toBeVisible();
    await expect(rowOf(page, a.name).getByText('Inactivo')).toBeVisible();
    await rowOf(page, a.name)
      .getByRole('button', { name: `Activar ${a.name}` })
      .click();
    await rowOf(page, a.name)
      .getByRole('button', { name: 'Sí, activar' })
      .click();
    await expect(page.getByText(`${a.name} está activo.`)).toBeVisible();
  });

  test('eliminar: confirma, y los 409 usan el texto del back (CA-09)', async ({
    page,
  }) => {
    const free = await createProduct(page.request);
    const part1 = await createProduct(page.request);
    const part2 = await createProduct(page.request);
    const combo = await createCombo(page.request, [
      { id: part1.id },
      { id: part2.id },
    ]);
    made.push(free, part1, part2, combo);
    await adminOn(page);

    await findInCatalog(page, part1.sku);
    await page.getByRole('button', { name: `Editar ${part1.name}` }).click();
    let d = dialog(page);
    await d.getByRole('button', { name: 'Eliminar producto' }).click();
    await d.getByRole('button', { name: 'Sí, eliminar' }).click();
    await expect(
      d.getByText('El producto es componente de un combo.'),
    ).toBeVisible();
    await expect(
      d.getByRole('button', { name: `Desactivar ${part1.name}` }),
    ).toBeVisible();
    await d.getByRole('button', { name: 'Cerrar' }).click();

    await findInCatalog(page, free.sku);
    await page.getByRole('button', { name: `Editar ${free.name}` }).click();
    d = dialog(page);
    await d.getByRole('button', { name: 'Eliminar producto' }).click();
    await d.getByRole('button', { name: 'Cancelar' }).click();
    await d.getByRole('button', { name: 'Eliminar producto' }).click();
    await d.getByRole('button', { name: 'Sí, eliminar' }).click();
    await expect(page.getByText(`Eliminamos ${free.name}.`)).toBeVisible();
    made.splice(made.indexOf(free), 1);
  });

  test('el 409 por movimientos se explica y se ofrece desactivar (CA-09)', async ({
    page,
  }) => {
    const p = await createProduct(page.request);
    made.push(p);
    const token = await adminToken(page.request);
    const mv = await page.request.post(`${API}/movements`, {
      headers: { authorization: `Bearer ${token}` },
      data: { productId: p.id, type: 'IN', quantity: 3, reason: 'Producción' },
    });
    expect(mv.status()).toBe(201);
    await adminOn(page);
    await findInCatalog(page, p.sku);
    await page.getByRole('button', { name: `Editar ${p.name}` }).click();
    const d = dialog(page);
    await d.getByRole('button', { name: 'Eliminar producto' }).click();
    await d.getByRole('button', { name: 'Sí, eliminar' }).click();
    await expect(d.getByText(/El producto tiene movimientos/)).toBeVisible();
    await d.getByRole('button', { name: `Desactivar ${p.name}` }).click();
    await d.getByRole('button', { name: 'Sí, desactivar' }).click();
    await expect(page.getByText(`${p.name} está inactivo.`)).toBeVisible();
  });

  test('un corte de red al crear conserva lo escrito, ofrece «Reintentar» y no duplica (CA-10)', async ({
    page,
  }) => {
    const u = unique();
    await adminOn(page);
    await page.getByRole('button', { name: 'Crear producto' }).click();
    const d = dialog(page);
    await d.getByLabel('SKU').fill(u.sku);
    await d.getByLabel('Nombre').fill(u.name);
    await d.getByLabel('Precio').fill('1000');
    await d.getByLabel('Costo').fill('100');
    let posts = 0;
    await page.route('**/api/products', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      posts += 1;
      await route.abort('failed');
    });
    await d.getByRole('button', { name: 'Crear producto' }).click();
    await expect(d.getByRole('button', { name: 'Reintentar' })).toBeVisible();
    await expect(d.getByLabel('Nombre')).toHaveValue(u.name);
    expect(posts).toBe(1);
    await page.unroute('**/api/products');
    await d.getByRole('button', { name: 'Reintentar' }).click();
    await expect(page.getByText(`Producto ${u.name} creado.`)).toBeVisible();
    await findInCatalog(page, u.sku);
    const token = await adminToken(page.request);
    const found = await page.request.get(`${API}/products?search=${u.sku}`, {
      headers: { authorization: `Bearer ${token}` },
    });
    made.push(...((await found.json()) as { data: MockProduct[] }).data);
  });

  test('sin desborde horizontal y botones de al menos 48 px (CA-13)', async ({
    page,
  }) => {
    const p = await createProduct(page.request);
    made.push(p);
    await adminOn(page);
    await findInCatalog(page, p.sku);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    for (const name of [
      'Crear producto',
      `Editar ${p.name}`,
      `Desactivar ${p.name}`,
      `Marcar agotado ${p.name}`,
    ]) {
      const box = await page
        .getByRole('button', { name })
        .first()
        .boundingBox();
      expect(box!.height, name).toBeGreaterThanOrEqual(47.5);
    }
    await page.getByRole('button', { name: `Editar ${p.name}` }).click();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    for (const name of ['Eliminar producto']) {
      const box = await dialog(page)
        .getByRole('button', { name })
        .boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(47.5);
    }
  });
});
