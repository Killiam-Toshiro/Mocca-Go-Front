import { expect, test, type Page } from '@playwright/test';
import { newCustomerSession } from './helpers';

const MOCK = 'http://127.0.0.1:4010';
const STREAM = '**/api/orders/stream';

/** Hace un pedido con el flujo real y devuelve su id. */
async function placeOrder(page: Page): Promise<string> {
  await page.goto('/cliente/menu');
  await page
    .getByRole('button', { name: 'Agregar Capuchino al carrito' })
    .click();
  await page.getByRole('button', { name: /Abrir carrito/ }).click();
  await page.getByRole('link', { name: 'Continuar' }).click();
  await page.getByLabel('Zona').selectOption({ label: 'Zona 1' });
  await page
    .getByLabel('Punto de entrega')
    .selectOption({ label: 'Plazoleta central' });
  await page.getByRole('button', { name: 'Usar tarjeta de prueba' }).click();
  await page.getByRole('button', { name: /^Pagar/ }).click();
  await expect(page).toHaveURL(/\/cliente\/pedidos\/[0-9a-f-]{36}/);
  return /pedidos\/([0-9a-f-]{36})/.exec(page.url())![1]!;
}

const history = (page: Page) =>
  page.getByRole('list', { name: 'Historial del pedido' });
const announcer = (page: Page) =>
  page.locator('[aria-live="polite"]').filter({ hasText: 'Pedido #' });

test.describe('seguimiento en vivo (SSE)', () => {
  test('el detalle cambia en segundos, sin recargar y sin esperar el sondeo de 15 s', async ({
    page,
    request,
  }) => {
    await newCustomerSession(page);
    const id = await placeOrder(page);
    await expect(page.getByText('En vivo', { exact: true })).toBeVisible();

    await request.post(`${MOCK}/__mock/orders/${id}/status`, {
      data: { status: 'en_preparacion' },
    });
    // El sondeo tardaría hasta 15 s; el canal en vivo lo trae casi al instante.
    await expect(history(page).getByText('En preparación')).toBeVisible({
      timeout: 5_000,
    });
    await expect(announcer(page)).toHaveText(/Pedido #\d+: En preparación/);

    await request.post(`${MOCK}/__mock/orders/${id}/status`, {
      data: { status: 'en_camino' },
    });
    await expect(
      page.getByRole('heading', { name: 'Tu repartidor' }),
    ).toBeVisible({ timeout: 5_000 });
    await expect(page.getByText('Carlos Gómez')).toBeVisible();

    await request.post(`${MOCK}/__mock/orders/${id}/status`, {
      data: { status: 'entregado' },
    });
    await expect(history(page).getByText('Entregado')).toBeVisible({
      timeout: 5_000,
    });
    // Un pedido terminado ya no necesita el indicador.
    await expect(page.getByText('En vivo', { exact: true })).toHaveCount(0);
  });

  test('«Mis pedidos» cambia una fila y muestra un pedido nuevo hecho en otra pestaña', async ({
    page,
    context,
    request,
  }) => {
    await newCustomerSession(page);
    const id = await placeOrder(page);
    await page.goto('/cliente/pedidos');
    await expect(page.getByText('En vivo', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: /Pedido #/ })).toHaveCount(1);

    await request.post(`${MOCK}/__mock/orders/${id}/status`, {
      data: { status: 'en_camino' },
    });
    await expect(
      page.getByRole('link', { name: /Pedido #/ }).getByText('En camino'),
    ).toBeVisible({ timeout: 5_000 });

    const other = await context.newPage();
    await placeOrder(other);
    await expect(page.getByRole('link', { name: /Pedido #/ })).toHaveCount(2, {
      timeout: 5_000,
    });
    await other.close();
  });

  test('si el canal se corta muestra «Reconectando…» y vuelve a «En vivo»', async ({
    page,
    request,
  }) => {
    await newCustomerSession(page);
    // Los dos primeros canales terminan al instante (como una caída); el tercero es el real.
    let cut = 0;
    await page.route(STREAM, async (route) => {
      if (cut++ < 2) {
        await route.fulfill({
          status: 200,
          contentType: 'text/event-stream',
          body: 'event: ready\ndata: {}\n\n',
        });
      } else {
        await route.continue();
      }
    });
    const id = await placeOrder(page);
    await expect(page.getByText('Reconectando…')).toBeVisible({
      timeout: 5_000,
    });
    await expect(page.getByText('En vivo', { exact: true })).toBeVisible({
      timeout: 10_000,
    });

    // Ya reconectado, los cambios vuelven a llegar en vivo.
    await request.post(`${MOCK}/__mock/orders/${id}/status`, {
      data: { status: 'listo' },
    });
    await expect(history(page).getByText('Listo')).toBeVisible({
      timeout: 5_000,
    });
  });

  test('si el canal es rechazado (429) la pantalla sigue al día con el sondeo de 15 s', async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    await newCustomerSession(page);
    await page.route(STREAM, (route) =>
      route.fulfill({
        status: 429,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 429, message: 'Too Many Requests' }),
      }),
    );
    const id = await placeOrder(page);
    await expect(page.getByText('Reconectando…')).toBeVisible();
    await expect(page.getByText('En vivo', { exact: true })).toHaveCount(0);

    await request.post(`${MOCK}/__mock/orders/${id}/status`, {
      data: { status: 'en_preparacion' },
    });
    await expect(history(page).getByText('En preparación')).toBeVisible({
      timeout: 25_000,
    });
  });

  test('sin permiso para el canal (403) no reintenta y avisa que se actualiza cada 15 s', async ({
    page,
  }) => {
    await newCustomerSession(page);
    let attempts = 0;
    await page.route(STREAM, (route) => {
      attempts += 1;
      return route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 403, message: 'Forbidden' }),
      });
    });
    await placeOrder(page);
    await expect(page.getByText('Se actualiza cada 15 s')).toBeVisible();
    // Cada carga de página abre un canal; dentro de la misma página no hay reintentos tras un 403.
    const afterLoad = attempts;
    await page.waitForTimeout(3_500);
    expect(attempts).toBe(afterLoad);
  });

  test('un solo canal por pestaña al navegar entre la lista y el detalle', async ({
    page,
  }) => {
    await newCustomerSession(page);
    let opened = 0;
    page.on('request', (req) => {
      if (new URL(req.url()).pathname === '/api/orders/stream') opened += 1;
    });
    await placeOrder(page);
    await expect(page.getByText('En vivo', { exact: true })).toBeVisible();

    await page.locator('a:visible', { hasText: 'Mis pedidos' }).first().click();
    await expect(page).toHaveURL(/\/cliente\/pedidos$/);
    await page.getByRole('link', { name: /Pedido #/ }).click();
    await expect(page).toHaveURL(/\/cliente\/pedidos\/[0-9a-f-]{36}$/);
    await page.locator('a:visible', { hasText: 'Mis pedidos' }).first().click();
    await expect(page.getByText('En vivo', { exact: true })).toBeVisible();
    expect(opened).toBe(1);
  });

  test('si el servidor cierra el canal con 401 la app pide ingresar de nuevo', async ({
    page,
  }) => {
    await newCustomerSession(page);
    await page.route(STREAM, (route) =>
      route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({ statusCode: 401, message: 'Unauthorized' }),
      }),
    );
    // La redirección a /login interrumpe la carga: es lo esperado.
    await page.goto('/cliente/pedidos').catch(() => undefined);
    await expect(page).toHaveURL(/\/login/);
  });
});
