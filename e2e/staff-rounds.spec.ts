import { expect, test, type Page } from '@playwright/test';
import { login, newCustomerSession, placeOrder } from './helpers';
import { API, createStaff } from './users-helpers';

const MOCK = 'http://127.0.0.1:4010';
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

test.describe('rondas del personal', () => {
  test('el admin ve la ronda de un repartidor, entra al detalle y llega al pedido; el operador también', async ({
    page,
    browser,
    request,
  }) => {
    test.setTimeout(90_000);
    const courier = await createStaff(request, { role: 'repartidor' });
    const customer = await browser.newContext();
    const cp = await customer.newPage();
    await newCustomerSession(cp);
    const order = await placeOrder(cp, {
      zone: 'Zona 2',
      point: 'Cafetería',
    });
    await request.post(`${MOCK}/__mock/orders/${order.id}/status`, {
      data: { status: 'listo' },
    });
    try {
      const login1 = await request.post(`${API}/auth/login`, {
        data: { username: courier.username, password: 'Password-123456' },
      });
      const { accessToken } = (await login1.json()) as { accessToken: string };
      const created = await request.post(`${API}/dispatch/rounds`, {
        headers: { authorization: `Bearer ${accessToken}` },
        data: { orderIds: [order.id] },
      });
      expect(created.status()).toBe(201);

      await login(page, 'admin', '/admin');
      await page.goto('/admin/rondas');
      await expect(
        page.getByRole('heading', { name: 'Rondas', level: 1 }),
      ).toBeVisible();
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      await page.getByLabel('Estado').selectOption('activa');
      const row = page
        .getByRole('link', { name: /Ronda · Zona 2/ })
        .filter({ hasText: courier.fullName ?? 'Repartidor Prueba' })
        .first();
      await expect(row).toBeVisible();
      await row.click();

      await expect(
        page.getByRole('heading', { name: 'Ronda · Zona 2', level: 1 }),
      ).toBeVisible();
      await expect(
        page.getByText(courier.fullName ?? 'Repartidor Prueba').first(),
      ).toBeVisible();
      expect(await overflow(page)).toBeLessThanOrEqual(0);
      await page
        .getByRole('link', { name: `Pedido #${String(order.number)}` })
        .click();
      await expect(page).toHaveURL(new RegExp(`/admin/pedidos/${order.id}$`));
      await expect(page.getByText('En camino').first()).toBeVisible();

      await page.context().clearCookies();
      await login(page, 'operador', /\/operador$/);
      await page.goto('/operador/rondas');
      await expect(
        page.getByRole('heading', { name: 'Rondas', level: 1 }),
      ).toBeVisible();
    } finally {
      await request.post(`${MOCK}/__mock/orders/${order.id}/status`, {
        data: { status: 'entregado' },
      });
      await customer.close();
    }
  });

  test('sin canal en vivo la lista se refresca sola cada 15 s con la pestaña visible', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await login(page, 'admin', '/admin');
    let calls = 0;
    await page.route('**/api/dispatch/rounds?*', async (route) => {
      calls += 1;
      await route.continue();
    });
    await page.goto('/admin/rondas');
    await expect(page.getByLabel('Estado')).toBeVisible();
    await expect
      .poll(() => calls, { timeout: 5_000 })
      .toBeGreaterThanOrEqual(1);
    const first = calls;
    await expect.poll(() => calls, { timeout: 25_000 }).toBeGreaterThan(first);
  });
});
