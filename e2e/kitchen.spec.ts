import {
  expect,
  test,
  type APIRequestContext,
  type Page,
} from '@playwright/test';
import { login, newCustomerSession, placeOrder } from './helpers';

const MOCK = 'http://127.0.0.1:4010';
const KITCHEN_STREAM = '**/api/kitchen/stream';

const column = (page: Page, name: string) =>
  page.getByRole('region', { name: new RegExp(`^${name}`) });
/** En pantallas estrechas solo se ve una columna: la elige antes de mirarla. */
async function show(page: Page, name: string) {
  const group = page.getByRole('group', { name: 'Columna que se muestra' });
  if (await group.isVisible()) {
    await group.getByRole('button', { name: new RegExp(name) }).click();
  }
}
const card = (page: Page, name: string, number: number) =>
  column(page, name).getByRole('article', {
    name: `Pedido #${String(number)}`,
  });

/** Deja el pedido fuera de «Listos» para no ensuciar la cocina de otras pruebas. */
async function finish(request: APIRequestContext, id: string) {
  await request.post(`${MOCK}/__mock/orders/${id}/status`, {
    data: { status: 'entregado' },
  });
}

/** Un cliente nuevo, en su propio contexto, hace un pedido. */
async function customerOrders(browser: import('@playwright/test').Browser) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await newCustomerSession(page);
  const order = await placeOrder(page);
  return { context, page, ...order };
}

test.describe('cocina', () => {
  test('guardas: visitante, cliente, operador y admin', async ({
    page,
    browser,
  }) => {
    await page.goto('/operador/cocina');
    await expect(page).toHaveURL(/\/login/);

    const customer = await browser.newContext();
    const customerPage = await customer.newPage();
    await newCustomerSession(customerPage);
    await customerPage.goto('/operador/cocina');
    await expect(customerPage).toHaveURL(/\/cliente$/);
    await customer.close();

    await login(page, 'operador', '/operador');
    await page.goto('/operador/cocina');
    await expect(page).toHaveURL(/\/operador\/cocina$/);
    await expect(
      page.getByRole('heading', { name: 'Cocina', level: 1 }),
    ).toBeVisible();

    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, 'admin', '/admin');
    await adminPage.goto('/admin/cocina');
    await expect(
      adminPage.getByRole('heading', { name: 'Cocina', level: 1 }),
    ).toBeVisible();
    await adminPage.goto('/operador/cocina');
    await expect(adminPage).toHaveURL(/\/admin$/);
    await adminContext.close();
  });

  test('un pedido nuevo aparece, se empieza y se marca listo, y el cliente lo ve en vivo', async ({
    page,
    browser,
    request,
  }) => {
    await login(page, 'operador', '/operador');
    await page.goto('/operador/cocina');
    await expect(page.getByText('En vivo', { exact: true })).toBeVisible();

    const customer = await customerOrders(browser);
    try {
      // CA-07: llega en segundos y se anuncia.
      const porPreparar = card(page, 'Por preparar', customer.number);
      await expect(porPreparar).toBeVisible({ timeout: 5_000 });
      await expect(
        page
          .locator('[aria-live="polite"]')
          .filter({ hasText: `Nuevo pedido #${String(customer.number)}` }),
      ).toHaveCount(1);
      await expect(porPreparar.getByText('1 × Capuchino')).toBeVisible();
      await expect(porPreparar.getByText('Cliente de Prueba')).toBeVisible();

      // CA-04 y CA-10: empezar se ve en el seguimiento del cliente.
      await page
        .getByRole('button', {
          name: `Empezar el pedido ${String(customer.number)}`,
        })
        .click();
      await show(page, 'En preparación');
      await expect(card(page, 'En preparación', customer.number)).toBeVisible();
      await expect(card(page, 'Por preparar', customer.number)).toHaveCount(0);
      const history = customer.page.getByRole('list', {
        name: 'Historial del pedido',
      });
      await expect(history.getByText('En preparación')).toBeVisible({
        timeout: 5_000,
      });

      await page
        .getByRole('button', {
          name: `Marcar listo el pedido ${String(customer.number)}`,
        })
        .click();
      await show(page, 'Listos');
      await expect(card(page, 'Listos', customer.number)).toBeVisible();
      await expect(history.getByText('Listo', { exact: true })).toBeVisible({
        timeout: 5_000,
      });
    } finally {
      await finish(request, customer.id);
      await customer.context.close();
    }
  });

  test('cancelar pide motivo y el cliente ve el motivo y el reembolso', async ({
    page,
    browser,
  }) => {
    await login(page, 'operador', '/operador');
    await page.goto('/operador/cocina');
    const customer = await customerOrders(browser);
    try {
      await expect(card(page, 'Por preparar', customer.number)).toBeVisible({
        timeout: 5_000,
      });
      await page
        .getByRole('button', {
          name: `Cancelar el pedido ${String(customer.number)}`,
        })
        .click();
      await page.getByRole('button', { name: 'Confirmar cancelación' }).click();
      await expect(
        page.getByText('Escribe el motivo de la cancelación.'),
      ).toBeVisible();
      await page
        .getByLabel(/Motivo de la cancelación/)
        .fill('Se acabó el café');
      await page.getByRole('button', { name: 'Confirmar cancelación' }).click();
      await expect(card(page, 'Por preparar', customer.number)).toHaveCount(0);

      await expect(
        customer.page.getByText('Motivo de la cancelación: Se acabó el café'),
      ).toBeVisible({
        timeout: 5_000,
      });
      await expect(customer.page.getByText('Reembolsado')).toBeVisible();
    } finally {
      await customer.context.close();
    }
  });

  test('si otro operador ya cambió el pedido se explica el conflicto (409)', async ({
    page,
    browser,
    request,
  }) => {
    test.setTimeout(60_000);
    await login(page, 'operador', '/operador');
    await page.goto('/operador/cocina');
    const customer = await customerOrders(browser);
    // La segunda cocina no recibe el canal: queda desactualizada y choca con el back.
    const otherContext = await browser.newContext();
    const other = await otherContext.newPage();
    await other.route(KITCHEN_STREAM, (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: '{}',
      }),
    );
    try {
      await login(other, 'operador', '/operador');
      await other.goto('/operador/cocina');
      await expect(card(other, 'Por preparar', customer.number)).toBeVisible({
        timeout: 20_000,
      });
      await expect(card(page, 'Por preparar', customer.number)).toBeVisible({
        timeout: 5_000,
      });

      await page
        .getByRole('button', {
          name: `Empezar el pedido ${String(customer.number)}`,
        })
        .click();
      await show(page, 'En preparación');
      await expect(card(page, 'En preparación', customer.number)).toBeVisible();

      await other
        .getByRole('button', {
          name: `Empezar el pedido ${String(customer.number)}`,
        })
        .click();
      await expect(
        other.getByText(
          `Pedido #${String(customer.number)}: Otro operador ya cambió este pedido.`,
        ),
      ).toBeVisible();
    } finally {
      await finish(request, customer.id);
      await otherContext.close();
      await customer.context.close();
    }
  });

  test('con el canal rechazado (429) la cocina sigue al día con el sondeo de 15 s', async ({
    page,
    browser,
    request,
  }) => {
    test.setTimeout(60_000);
    await page.route(KITCHEN_STREAM, (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: '{}',
      }),
    );
    await login(page, 'operador', '/operador');
    await page.goto('/operador/cocina');
    await expect(page.getByText('Reconectando…')).toBeVisible();

    const customer = await customerOrders(browser);
    try {
      await expect(card(page, 'Por preparar', customer.number)).toBeVisible({
        timeout: 25_000,
      });
    } finally {
      await finish(request, customer.id);
      await customer.context.close();
    }
  });

  test('diseño: sin desborde horizontal y botones de al menos 48 px', async ({
    page,
    browser,
    request,
  }, testInfo) => {
    await login(page, 'operador', '/operador');
    await page.goto('/operador/cocina');
    const customer = await customerOrders(browser);
    try {
      const target = page.getByRole('button', {
        name: `Empezar el pedido ${String(customer.number)}`,
      });
      // En pantallas estrechas solo se ve una columna a la vez: «Por preparar» es la inicial.
      await expect(target).toBeVisible({ timeout: 5_000 });
      const box = await target.boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(48);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - window.innerWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);

      if (testInfo.project.name === 'mobile-360') {
        const group = page.getByRole('group', {
          name: 'Columna que se muestra',
        });
        await expect(group).toBeVisible();
        await group.getByRole('button', { name: /Listos/ }).click();
        await expect(column(page, 'Listos')).toBeVisible();
        await expect(column(page, 'Por preparar')).toBeHidden();
      } else {
        await expect(
          page.getByRole('group', { name: 'Columna que se muestra' }),
        ).toBeHidden();
        await expect(column(page, 'Listos')).toBeVisible();
      }
    } finally {
      await finish(request, customer.id);
      await customer.context.close();
    }
  });
});
