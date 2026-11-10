import { expect, test, type Page } from '@playwright/test';
import { newCustomerSession } from './helpers';

const MOCK = 'http://127.0.0.1:4010';

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

test.describe('seguimiento del pedido', () => {
  test('el detalle se actualiza solo (cada 15 s) y oculta «Cancelar» al empezar la preparación', async ({
    page,
    request,
  }) => {
    test.setTimeout(60_000);
    await newCustomerSession(page);
    const id = await placeOrder(page);
    await expect(
      page.getByRole('button', { name: 'Cancelar pedido' }),
    ).toBeVisible();

    await request.post(`${MOCK}/__mock/orders/${id}/status`, {
      data: { status: 'en_preparacion' },
    });
    // Sin recargar: la consulta periódica (15 s) trae el cambio.
    const history = page.getByRole('list', { name: 'Historial del pedido' });
    await expect(history.getByText('En preparación')).toBeVisible({
      timeout: 25_000,
    });
    await expect(
      page.getByRole('button', { name: 'Cancelar pedido' }),
    ).toHaveCount(0);

    await request.post(`${MOCK}/__mock/orders/${id}/status`, {
      data: { status: 'en_camino' },
    });
    await page.reload();
    await expect(
      page.getByRole('heading', { name: 'Tu repartidor' }),
    ).toBeVisible();
    await expect(page.getByText('Carlos Gómez')).toBeVisible();
    await expect(page.getByText(/Llegada estimada/)).toBeVisible();
    await expect(page.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute(
      'href',
      'https://wa.me/573001234500',
    );

    await request.post(`${MOCK}/__mock/orders/${id}/status`, {
      data: { status: 'entregado' },
    });
    await page.reload();
    await expect(history.getByText('Entregado')).toBeVisible();
    await expect(
      page.getByRole('heading', { name: 'Tu repartidor' }),
    ).toHaveCount(0);
  });

  test('cancelar cuando el pedido ya cambió de estado explica el conflicto', async ({
    page,
    request,
  }) => {
    await newCustomerSession(page);
    const id = await placeOrder(page);
    await page.getByRole('button', { name: 'Cancelar pedido' }).click();
    await request.post(`${MOCK}/__mock/orders/${id}/status`, {
      data: { status: 'en_preparacion' },
    });
    await page.getByRole('button', { name: 'Sí, cancelar' }).click();
    await expect(page.getByText(/ya entró a preparación/)).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Cancelar pedido' }),
    ).toHaveCount(0);
  });

  test('un pedido ajeno se ve como «no encontrado»', async ({
    page,
    browser,
  }) => {
    await newCustomerSession(page);
    const id = await placeOrder(page);

    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await newCustomerSession(otherPage);
    await otherPage.goto(`/cliente/pedidos/${id}`);
    await expect(
      otherPage.getByText('No encontramos este pedido.'),
    ).toBeVisible();
    await other.close();
  });

  test('«Mis pedidos» vacío invita a ver el menú y el panel enlaza a los pedidos', async ({
    page,
  }) => {
    await newCustomerSession(page);
    await page.goto('/cliente/pedidos');
    await expect(page.getByText('Aún no has hecho pedidos.')).toBeVisible();
    await expect(page.getByRole('link', { name: 'Ver el menú' })).toBeVisible();
  });

  test('un pedido no entregado muestra su motivo y no consulta más', async ({
    page,
    request,
  }) => {
    await newCustomerSession(page);
    const id = await placeOrder(page);
    await request.post(`${MOCK}/__mock/orders/${id}/status`, {
      data: { status: 'no_entregado' },
    });
    await page.reload();
    await expect(page.getByText(/No pudimos entregar tu pedido/)).toBeVisible();
    await expect(page.getByText('No entregado').first()).toBeVisible();
  });
});
