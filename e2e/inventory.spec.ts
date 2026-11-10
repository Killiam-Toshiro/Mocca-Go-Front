import { expect, test, type Page } from '@playwright/test';
import { login, newCustomerSession } from './helpers';

const MOCK = 'http://127.0.0.1:4010';

/** Cada proyecto (escritorio y 360 px) corre en paralelo contra el mismo mock: productos distintos. */
const PRODUCTS = {
  desktop: {
    soldOut: 'Espresso',
    soldOutSku: 'CAF-ESPR',
    moves: 'Americano',
    movesSku: 'CAF-AMER',
  },
  'mobile-360': {
    soldOut: 'Latte',
    soldOutSku: 'CAF-LATT',
    moves: 'Mocca',
    movesSku: 'CAF-MOCC',
  },
} as const;

function mine(project: string) {
  return PRODUCTS[project as keyof typeof PRODUCTS];
}

const row = (page: Page, name: string) =>
  page
    .getByRole('heading', { name, level: 3 })
    .locator('xpath=ancestor::li[1]');

test.describe('productos e inventario', () => {
  test.beforeEach(async ({ request }, testInfo) => {
    const p = mine(testInfo.project.name);
    for (const sku of [p.soldOutSku, p.movesSku])
      await request.post(`${MOCK}/__mock/inventory`, {
        data: { sku, stock: 50, soldOut: false, active: true },
      });
  });

  test('guardas: cada rol ve solo lo suyo', async ({ page, browser }) => {
    await page.goto('/operador/productos');
    await expect(page).toHaveURL(/\/login/);

    const customer = await browser.newContext();
    const customerPage = await customer.newPage();
    await newCustomerSession(customerPage);
    await customerPage.goto('/operador/inventario');
    await expect(customerPage).toHaveURL(/\/cliente$/);
    await customer.close();

    await login(page, 'operador', '/operador');
    for (const [path, title] of [
      ['/operador/productos', 'Productos'],
      ['/operador/inventario', 'Inventario'],
    ] as const) {
      await page.goto(path);
      await expect(
        page.getByRole('heading', { name: title, level: 1 }),
      ).toBeVisible();
    }
    await page.goto('/admin/inventario');
    await expect(page).toHaveURL(/\/operador$/);

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, 'admin', '/admin');
    await adminPage.goto('/admin/inventario');
    await expect(
      adminPage.getByRole('heading', { name: 'Inventario', level: 1 }),
    ).toBeVisible();
    await adminPage.goto('/operador/inventario');
    await expect(adminPage).toHaveURL(/\/admin$/);
    await adminContext.close();
  });

  test('agotar un producto lo saca del menú del cliente y volver a vender lo regresa', async ({
    page,
    browser,
  }, testInfo) => {
    const { soldOut: name } = mine(testInfo.project.name);
    const customerContext = await browser.newContext();
    const customer = await customerContext.newPage();
    await newCustomerSession(customer);
    await customer.goto('/cliente/menu');
    const add = customer.getByRole('button', {
      name: `Agregar ${name} al carrito`,
    });
    await expect(add).toBeVisible();

    await login(page, 'operador', '/operador');
    await page.goto('/operador/productos');
    await page.getByRole('button', { name: `Marcar agotado ${name}` }).click();
    await expect(page.getByText(`${name} ya no se puede pedir.`)).toBeVisible();
    await expect(row(page, name).getByText('Agotado')).toBeVisible();

    await customer.reload();
    await expect(
      customer.getByRole('button', { name: `Agregar ${name} al carrito` }),
    ).toHaveCount(0);

    await page.getByRole('button', { name: `Volver a vender ${name}` }).click();
    await expect(page.getByText(`${name} vuelve a venderse.`)).toBeVisible();
    await expect(
      row(page, name).getByText('Disponible', { exact: true }),
    ).toBeVisible();
    await customer.reload();
    await expect(
      customer.getByRole('button', { name: `Agregar ${name} al carrito` }),
    ).toBeVisible();
    await customerContext.close();
  });

  test('una entrada sube el saldo, se ve en el historial y una salida mayor al saldo se bloquea', async ({
    page,
  }, testInfo) => {
    const { moves: name } = mine(testInfo.project.name);
    const reason = `Compra E2E ${testInfo.project.name} ${String(Date.now())}`;
    await login(page, 'operador', '/operador');
    await page.goto('/operador/inventario');

    await page
      .getByRole('button', { name: `Registrar movimiento de ${name}` })
      .click();
    const form = page.getByRole('form', {
      name: `Registrar movimiento de ${name}`,
    });
    await form.getByLabel('Cantidad').fill('10');
    await form.getByRole('textbox', { name: 'Motivo' }).fill(reason);
    await form.getByRole('button', { name: 'Registrar producción' }).click();
    await expect(
      page.getByText(
        `Producción registrada: ${name} queda con 60 disponibles.`,
      ),
    ).toBeVisible();
    await expect(
      row(page, name).getByText('60', { exact: true }),
    ).toBeVisible();

    // Salida mayor al saldo: se bloquea en el formulario.
    await page
      .getByRole('button', { name: `Registrar movimiento de ${name}` })
      .click();
    await form.getByText('Merma o salida', { exact: true }).click();
    await form.getByLabel('Cantidad').fill('61');
    await form.getByRole('textbox', { name: 'Motivo' }).fill('Merma');
    await form.getByRole('button', { name: 'Registrar salida' }).click();
    await expect(form.getByText('Hay 60; no puedes sacar 61.')).toBeVisible();
    await form.getByRole('button', { name: 'Cancelar' }).click();

    await page.getByRole('button', { name: 'Historial' }).click();
    await page.getByLabel('Producto').selectOption({ label: name });
    const first = page.getByRole('main').getByRole('listitem').first();
    await expect(first).toContainText(reason);
    await expect(first).toContainText('operador');
    await expect(first).toContainText('+10');
  });

  test('si el saldo cambió por otro lado, el 409 del back se explica sin perder lo escrito', async ({
    page,
    request,
  }, testInfo) => {
    const { moves: name, movesSku } = mine(testInfo.project.name);
    await login(page, 'operador', '/operador');
    await page.goto('/operador/inventario');
    await page
      .getByRole('button', { name: `Registrar movimiento de ${name}` })
      .click();
    const form = page.getByRole('form', {
      name: `Registrar movimiento de ${name}`,
    });
    // Otro operador deja el producto sin saldo mientras este formulario sigue abierto.
    await request.post(`${MOCK}/__mock/inventory`, {
      data: { sku: movesSku, stock: 0 },
    });
    await form.getByText('Merma o salida', { exact: true }).click();
    await form.getByLabel('Cantidad').fill('5');
    await form.getByRole('textbox', { name: 'Motivo' }).fill('Merma');
    await form.getByRole('button', { name: 'Registrar salida' }).click();
    await expect(form.getByText('Saldo insuficiente: hay 0')).toBeVisible();
    await expect(form.getByLabel('Cantidad')).toHaveValue('5');
    await expect(form.getByRole('textbox', { name: 'Motivo' })).toHaveValue(
      'Merma',
    );
  });

  test('un corte de red al registrar no se reintenta y pide revisar el historial', async ({
    page,
  }, testInfo) => {
    const { moves: name } = mine(testInfo.project.name);
    let posts = 0;
    await page.route('**/api/movements', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      posts += 1;
      await route.abort('connectionreset');
    });
    await login(page, 'operador', '/operador');
    await page.goto('/operador/inventario');
    await page
      .getByRole('button', { name: `Registrar movimiento de ${name}` })
      .click();
    const form = page.getByRole('form', {
      name: `Registrar movimiento de ${name}`,
    });
    await form.getByLabel('Cantidad').fill('3');
    await form.getByRole('textbox', { name: 'Motivo' }).fill('Compra');
    await form.getByRole('button', { name: 'Registrar producción' }).click();
    await expect(
      form.getByText(/No sabemos si se registró: revisa el historial/),
    ).toBeVisible();
    await expect(
      form.getByRole('button', { name: 'Registrar producción' }),
    ).toBeDisabled();
    await page.waitForTimeout(500);
    expect(posts).toBe(1);
    await form.getByRole('button', { name: 'Ver historial' }).click();
    await expect(page.getByLabel('Producto')).toBeVisible();
  });

  test('preparar el día: aplica un lote, queda en el historial y una falla parcial no frena el resto', async ({
    page,
  }, testInfo) => {
    const { soldOut: a, moves: b } = mine(testInfo.project.name);
    let first = true;
    await login(page, 'operador', '/operador');
    await page.goto('/operador/inventario');
    await page.getByRole('button', { name: 'Preparar el día' }).click();
    await page.getByLabel(`Para hoy: ${a}`).fill('70');
    await page.getByLabel(`Para hoy: ${b}`).fill('20');
    await expect(page.getByLabel(`Diferencia de ${a}: +20`)).toBeVisible();
    await expect(page.getByLabel(`Diferencia de ${b}: −30`)).toBeVisible();

    // El segundo movimiento falla con 409; el primero ya quedó registrado.
    await page.route('**/api/movements', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      const body = route.request().postDataJSON() as { quantity: number };
      if (body.quantity === 30) {
        first = false;
        return route.fulfill({
          status: 409,
          contentType: 'application/json',
          body: JSON.stringify({
            statusCode: 409,
            message: 'Saldo insuficiente: hay 3',
          }),
        });
      }
      return route.continue();
    });
    await page.getByRole('button', { name: 'Revisar cambios' }).click();
    await page.getByRole('button', { name: 'Aplicar 2 cambios' }).click();
    await expect(
      page.getByText('1 aplicados, 1 con error, 0 por revisar.'),
    ).toBeVisible();
    expect(first).toBe(false);
    await expect(page.getByLabel(`Para hoy: ${a}`)).toHaveValue('');
    await expect(page.getByLabel(`Para hoy: ${b}`)).toHaveValue('20');
    await page.unroute('**/api/movements');

    await page.getByRole('button', { name: 'Historial' }).click();
    await page.getByLabel('Producto').selectOption({ label: a });
    const entry = page.getByRole('main').getByRole('listitem').first();
    await expect(entry).toContainText('Preparar el día');
    await expect(entry).toContainText('operador');
    await expect(entry).toContainText('+20');
  });

  test('diseño: sin desborde horizontal y botones de al menos 48 px', async ({
    page,
  }, testInfo) => {
    const { soldOut: name } = mine(testInfo.project.name);
    await login(page, 'operador', '/operador');
    for (const path of ['/operador/productos', '/operador/inventario']) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name, level: 3 })).toBeVisible();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    }
    await page.goto('/operador/productos');
    const toggle = page.getByRole('button', { name: `Marcar agotado ${name}` });
    expect((await toggle.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    await page.goto('/operador/inventario');
    const register = page.getByRole('button', {
      name: `Registrar movimiento de ${name}`,
    });
    expect((await register.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    await register.click();
    const form = page.getByRole('form', {
      name: `Registrar movimiento de ${name}`,
    });
    await expect(form).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
    const submit = form.getByRole('button', { name: 'Registrar producción' });
    expect((await submit.boundingBox())!.height).toBeGreaterThanOrEqual(48);

    await page.goto('/operador/inventario');
    await page.getByRole('button', { name: 'Preparar el día' }).click();
    await page.getByLabel(`Para hoy: ${name}`).fill('5');
    const review = page.getByRole('button', { name: 'Revisar cambios' });
    expect((await review.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      ),
    ).toBeLessThanOrEqual(0);
  });
});
