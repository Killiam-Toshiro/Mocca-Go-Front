import { expect, test, type Page } from '@playwright/test';
import { newCustomerSession, placeOrder } from './helpers';

const MOCK = 'http://127.0.0.1:4010';

const star = (page: Page, name: string) =>
  page.locator('label', { has: page.getByRole('radio', { name }) });
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

/** Un cliente nuevo hace un pedido y el repartidor lo deja `entregado` (por el control del mock). */
async function deliveredOrder(
  page: Page,
  setStatus: (id: string, status: string) => Promise<unknown>,
  deliver = true,
) {
  await newCustomerSession(page);
  const order = await placeOrder(page);
  if (deliver) await setStatus(order.id, 'entregado');
  return order;
}

test.describe('encuesta del pedido', () => {
  test.beforeEach(({ request }) => {
    void request;
  });

  test('aparece sola al entregar, se califica y queda de solo lectura (CA-02 a CA-06)', async ({
    page,
    request,
  }) => {
    test.setTimeout(90_000);
    const setStatus = (id: string, status: string) =>
      request.post(`${MOCK}/__mock/orders/${id}/status`, { data: { status } });
    const order = await deliveredOrder(page, setStatus, false);
    await expect(page.getByText('¿Qué tal estuvo tu pedido?')).toHaveCount(0);

    // Con el detalle abierto: el canal en vivo trae «Entregado» y aparece la tarjeta, sin mover el foco.
    await setStatus(order.id, 'entregado');
    await expect(page.getByText('¿Qué tal estuvo tu pedido?')).toBeVisible({
      timeout: 25_000,
    });
    await expect(page.locator('[role="status"].sr-only').first()).toContainText(
      `Tu pedido #${String(order.number)} fue entregado`,
    );

    const send = page.getByRole('button', { name: 'Enviar calificación' });
    await expect(send).toBeDisabled();
    await expect(
      page.getByText('Al enviarla no podrás cambiarla.'),
    ).toBeVisible();
    await star(page, '4 de 5 · Buena').click();
    await expect(
      page.locator('p', { hasText: /^4 de 5 · Buena$/ }),
    ).toBeVisible();
    await page.getByLabel('Comentario (opcional)').fill('  Llegó caliente  ');
    await send.click();

    const title = page.getByRole('heading', { name: 'Tu calificación' });
    await expect(title).toBeFocused();
    await expect(page.getByText('Llegó caliente')).toBeVisible();
    await expect(
      page.locator('p', { hasText: '4 de 5 · Buena' }).first(),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Enviar/ })).toHaveCount(0);

    // Se guardó en el back: al recargar sigue ahí y no se puede volver a calificar.
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Tu calificación' }),
    ).toBeVisible();
    await expect(page.getByText('Llegó caliente')).toBeVisible();
    await expect(page.getByText('¿Qué tal estuvo tu pedido?')).toHaveCount(0);
  });

  test('un pedido en camino no pide calificación', async ({
    page,
    request,
  }) => {
    await newCustomerSession(page);
    const order = await placeOrder(page);
    await request.post(`${MOCK}/__mock/orders/${order.id}/status`, {
      data: { status: 'en_camino' },
    });
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Tu repartidor' }),
    ).toBeVisible();
    await expect(page.getByText('¿Qué tal estuvo tu pedido?')).toHaveCount(0);
  });

  test('calificada desde otra pestaña: el 409 se explica y se muestra la guardada (CA-05)', async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    const setStatus = (id: string, status: string) =>
      request.post(`${MOCK}/__mock/orders/${id}/status`, { data: { status } });
    const order = await deliveredOrder(page, setStatus);
    await page.reload();
    const other = await page.context().newPage();
    await other.goto(`/cliente/pedidos/${order.id}`);
    await expect(other.getByText('¿Qué tal estuvo tu pedido?')).toBeVisible();
    await expect(page.getByText('¿Qué tal estuvo tu pedido?')).toBeVisible();

    await star(other, '5 de 5 · Excelente').click();
    await other.getByRole('button', { name: 'Enviar calificación' }).click();
    await expect(
      other.getByRole('heading', { name: 'Tu calificación' }),
    ).toBeVisible();

    await star(page, '2 de 5 · Mala').click();
    await page.getByRole('button', { name: 'Enviar calificación' }).click();
    await expect(page.getByText(/ya tenía una calificación/)).toBeVisible();
    await expect(page.getByText('5 de 5 · Excelente')).toBeVisible();
    await page.getByRole('button', { name: 'Entendido' }).click();
    await expect(page.getByText(/ya tenía una calificación/)).toHaveCount(0);
  });

  test('un corte de red no reintenta solo, conserva lo escrito y deja reintentar', async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    const setStatus = (id: string, status: string) =>
      request.post(`${MOCK}/__mock/orders/${id}/status`, { data: { status } });
    await deliveredOrder(page, setStatus);
    await page.reload();
    let posts = 0;
    await page.route('**/api/orders/*/survey', (route) => {
      posts += 1;
      return route.abort('failed');
    });
    await star(page, '3 de 5 · Regular').click();
    await page.getByLabel('Comentario (opcional)').fill('Estuvo bien');
    await page.getByRole('button', { name: 'Enviar calificación' }).click();
    await expect(
      page.getByText(/No pudimos confirmar si se guardó/),
    ).toBeVisible();
    await expect(page.getByLabel('Comentario (opcional)')).toHaveValue(
      'Estuvo bien',
    );
    expect(posts).toBe(1);

    await page.unroute('**/api/orders/*/survey');
    await page.getByRole('button', { name: 'Reintentar' }).click();
    await expect(
      page.getByRole('heading', { name: 'Tu calificación' }),
    ).toBeVisible();
    await expect(page.getByText('Estuvo bien')).toBeVisible();
  });

  test('diseño: sin desborde y con estrellas y botón de al menos 48 px', async ({
    page,
    request,
  }) => {
    const setStatus = (id: string, status: string) =>
      request.post(`${MOCK}/__mock/orders/${id}/status`, { data: { status } });
    await deliveredOrder(page, setStatus);
    await page.reload();
    await expect(page.getByText('¿Qué tal estuvo tu pedido?')).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    for (const name of ['1 de 5 · Muy mala', '5 de 5 · Excelente']) {
      const box = await star(page, name).boundingBox();
      expect(box!.width).toBeGreaterThanOrEqual(48);
      expect(box!.height).toBeGreaterThanOrEqual(48);
    }
    await star(page, '5 de 5 · Excelente').click();
    const send = await page
      .getByRole('button', { name: 'Enviar calificación' })
      .boundingBox();
    expect(send!.height).toBeGreaterThanOrEqual(48);
    await page.screenshot({
      path: `test-results/survey-${String(page.viewportSize()?.width)}.png`,
      fullPage: true,
    });
  });
});
