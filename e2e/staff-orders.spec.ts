import { expect, test, type Page } from '@playwright/test';
import { login, newCustomerSession, placeOrder } from './helpers';

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

async function menuLink(page: Page, name: string) {
  const menu = page.getByRole('button', { name: 'Abrir menú' });
  const mobile = await menu.isVisible();
  if (mobile) await menu.click();
  await expect(page.getByRole('link', { name }).first()).toBeVisible();
  if (mobile) {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
}

test.describe('pedidos del personal', () => {
  test('guardas: visitante al login, cliente y repartidor a su panel; admin y operador lo ven en su menú', async ({
    page,
    browser,
  }) => {
    await page.goto('/admin/pedidos');
    await expect(page).toHaveURL(/\/login/);

    const customer = await browser.newContext();
    const cp = await customer.newPage();
    await newCustomerSession(cp);
    await cp.goto('/admin/pedidos');
    await expect(cp).toHaveURL(/\/cliente$/);
    await cp.goto('/operador/pedidos');
    await expect(cp).toHaveURL(/\/cliente$/);
    await customer.close();

    await login(page, 'repartidor', '/repartidor');
    await page.goto('/operador/rondas');
    await expect(page).toHaveURL(/\/repartidor$/);
    await page.context().clearCookies();

    await login(page, 'operador', /\/operador$/);
    await menuLink(page, 'Pedidos');
    await menuLink(page, 'Rondas');
    await page.context().clearCookies();
    await login(page, 'admin', '/admin');
    await menuLink(page, 'Pedidos');
    await menuLink(page, 'Rondas');
  });

  test('el admin ve un pedido de un cliente, lo filtra, abre el detalle y lo cancela con motivo; el cliente lo ve cancelado', async ({
    page,
    browser,
  }) => {
    test.setTimeout(90_000);
    const customer = await browser.newContext();
    const cp = await customer.newPage();
    await newCustomerSession(cp);
    const order = await placeOrder(cp);
    try {
      await login(page, 'admin', '/admin');
      await page.goto('/admin/pedidos');
      await expect(
        page.getByRole('heading', { name: 'Pedidos', level: 1 }),
      ).toBeVisible();
      const row = page.getByRole('link', {
        name: new RegExp(`Pedido #${String(order.number)}\\b`),
      });
      await expect(row).toBeVisible();
      await expect(row).toContainText('Cliente de Prueba');
      expect(await overflow(page)).toBeLessThanOrEqual(0);

      await page.getByLabel('Estado').selectOption('cancelado');
      await expect(row).toHaveCount(0);
      await page.getByLabel('Estado').selectOption('recibido');
      await row.click();

      await expect(page).toHaveURL(new RegExp(`/admin/pedidos/${order.id}$`));
      await expect(
        page.getByRole('heading', {
          name: `Pedido #${String(order.number)}`,
          level: 1,
        }),
      ).toBeVisible();
      await expect(page.getByText('Cliente de Prueba')).toBeVisible();
      await expect(page.getByText(/····\s*4242/)).toBeVisible();
      expect(await overflow(page)).toBeLessThanOrEqual(0);

      await page
        .getByRole('button', {
          name: `Cancelar el pedido ${String(order.number)}`,
        })
        .click();
      await page.getByRole('button', { name: 'Confirmar cancelación' }).click();
      await expect(
        page.getByText('Escribe el motivo de la cancelación.'),
      ).toBeVisible();
      await page.getByLabel(/Motivo de la cancelación/).fill('Sin insumos');
      await page.getByRole('button', { name: 'Confirmar cancelación' }).click();
      await expect(
        page.getByText('Motivo de la cancelación: Sin insumos'),
      ).toBeVisible();
      await expect(
        page.getByRole('button', { name: /Cancelar el pedido/ }),
      ).toHaveCount(0);

      await cp.goto(`/cliente/pedidos/${order.id}`);
      await expect(cp.getByText('Cancelado').first()).toBeVisible();
    } finally {
      await customer.close();
    }
  });

  test('el operador ve el detalle por su ruta y un pedido inexistente muestra el aviso', async ({
    page,
    browser,
  }) => {
    const customer = await browser.newContext();
    const cp = await customer.newPage();
    await newCustomerSession(cp);
    const order = await placeOrder(cp);
    try {
      await login(page, 'operador', /\/operador$/);
      await page.goto(`/operador/pedidos/${order.id}`);
      await expect(
        page.getByRole('heading', {
          name: `Pedido #${String(order.number)}`,
        }),
      ).toBeVisible();
      await page.goto('/operador/pedidos/0b1f6f8e-9a0c-4f3e-9d5e-0a1b2c3d4e5f');
      await expect(page.getByText('No encontramos este pedido.')).toBeVisible();
      await page.getByRole('link', { name: 'Ver pedidos' }).click();
      await expect(page).toHaveURL(/\/operador\/pedidos$/);
    } finally {
      await customer.close();
    }
  });
});
