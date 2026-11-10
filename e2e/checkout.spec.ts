import { expect, test, type Page } from '@playwright/test';
import { newCustomerSession } from './helpers';

const MOCK = 'http://127.0.0.1:4010';

// Desktop y móvil comparten el mock: cada proyecto agota su propio producto.
const OWN = {
  desktop: { sku: 'BEB-LIMO', name: 'Limonada natural' },
  'mobile-360': { sku: 'BEB-NARA', name: 'Jugo de naranja' },
} as const;

async function addCapuchinos(page: Page, times = 2) {
  await page.goto('/cliente/menu');
  const add = page.getByRole('button', {
    name: 'Agregar Capuchino al carrito',
  });
  for (let i = 0; i < times; i++) await add.click();
}

async function goToCheckout(page: Page) {
  await page.getByRole('button', { name: /Abrir carrito/ }).click();
  await page.getByRole('link', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Tu pedido' })).toBeVisible();
  await expect(page.getByLabel('Zona')).toBeVisible();
}

async function fillDelivery(page: Page, withFloor = true) {
  await page.getByLabel('Zona').selectOption({ label: 'Zona 1' });
  if (withFloor) {
    await page
      .getByLabel('Punto de entrega')
      .selectOption({ label: 'Edificio A' });
    await page.getByLabel('Piso').selectOption('2');
  } else {
    await page
      .getByLabel('Punto de entrega')
      .selectOption({ label: 'Plazoleta central' });
  }
}

async function sinDesborde(page: Page) {
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(width);
}

test.describe('pedido y pago', () => {
  test('un visitante no entra a la página de pedido', async ({ page }) => {
    await page.goto('/cliente/pedido');
    await expect(page).toHaveURL(/\/login/);
  });

  test('pagar crea el pedido, vacía el carrito y se puede cancelar con reembolso', async ({
    page,
  }) => {
    await newCustomerSession(page);
    await addCapuchinos(page);
    await goToCheckout(page);
    await sinDesborde(page);
    await fillDelivery(page);
    await page
      .getByLabel(/Indicación de entrega/)
      .fill('Junto a la entrada del salón 302');
    await page.getByRole('button', { name: 'Usar tarjeta de prueba' }).click();
    await page.getByRole('button', { name: /^Pagar \$9\.000/ }).click();

    await expect(page).toHaveURL(/\/cliente\/pedidos\/[0-9a-f-]{36}\?nuevo=1/);
    await expect(page.getByText(/¡Pedido #\d+ recibido!/)).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 1, name: /Pedido #/ }),
    ).toBeFocused();
    await expect(page.getByText('2 × Capuchino')).toBeVisible();
    await expect(page.getByText(/Zona 1 · Edificio A · Piso 2/)).toBeVisible();
    await expect(page.getByText(/···· 4242/)).toContainText('Aprobado');
    await sinDesborde(page);

    // El carrito quedó vacío.
    await page.goto('/cliente/menu');
    await expect(
      page.getByRole('button', { name: /Abrir carrito, \d/ }),
    ).toHaveCount(0);

    // Aparece en «Mis pedidos».
    await page.goto('/cliente/pedidos');
    const row = page.getByRole('link', { name: /Pedido #/ });
    await expect(row).toHaveCount(1);
    await expect(row).toContainText('Recibido');
    await expect(row).toContainText('$9.000');
    await row.click();

    // Cancelar → Cancelado y Reembolsado.
    await page.getByRole('button', { name: 'Cancelar pedido' }).click();
    await page.getByRole('button', { name: 'Sí, cancelar' }).click();
    await expect(page.getByText(/···· 4242/)).toContainText('Reembolsado');
    await expect(
      page.getByRole('button', { name: 'Cancelar pedido' }),
    ).toHaveCount(0);
  });

  test('la tarjeta rechazada avisa y conserva el carrito y lo escrito', async ({
    page,
  }) => {
    await newCustomerSession(page);
    await addCapuchinos(page, 1);
    await goToCheckout(page);
    await fillDelivery(page, false);
    await page.getByLabel('Número de tarjeta').fill('4000 0000 0000 0002');
    await page.getByRole('button', { name: /^Pagar/ }).click();
    await expect(page.getByText('La tarjeta fue rechazada.')).toBeVisible();
    await expect(page.getByLabel('Número de tarjeta')).toBeFocused();
    await expect(page.getByLabel('Punto de entrega')).toHaveValue(/.+/);
    await expect(page).toHaveURL(/\/cliente\/pedido$/);

    // Corregir con la tarjeta de prueba y pagar.
    await page.getByRole('button', { name: 'Usar tarjeta de prueba' }).click();
    await page.getByRole('button', { name: /^Pagar/ }).click();
    await expect(page).toHaveURL(/\/cliente\/pedidos\/.+\?nuevo=1/);
  });

  test('valida los campos obligatorios sin pagar', async ({ page }) => {
    await newCustomerSession(page);
    await addCapuchinos(page, 1);
    await goToCheckout(page);
    await page.getByRole('button', { name: /^Pagar/ }).click();
    await expect(page.getByText('Elige una zona.')).toBeVisible();
    await expect(
      page.getByText('Escribe los 16 dígitos de la tarjeta.'),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/cliente\/pedido$/);
  });

  test('con el carrito vacío, la página de pedido manda al menú con aviso', async ({
    page,
  }) => {
    await newCustomerSession(page);
    await page.goto('/cliente/pedido');
    await expect(page).toHaveURL(/\/cliente\/menu\?vacio=1/);
    await expect(page.getByText(/Tu carrito está vacío/)).toBeVisible();
  });

  test('si el producto se agota antes de pagar: aviso de conflicto y el carrito se conserva', async ({
    page,
    request,
  }, testInfo) => {
    const own = OWN[testInfo.project.name as keyof typeof OWN];
    await newCustomerSession(page);
    await page.goto('/cliente/menu');
    await page
      .getByRole('button', { name: `Agregar ${own.name} al carrito` })
      .click();
    await goToCheckout(page);
    await fillDelivery(page, false);
    await page.getByRole('button', { name: 'Usar tarjeta de prueba' }).click();
    await request.post(`${MOCK}/__mock/menu`, {
      data: { sku: own.sku, available: false },
    });
    try {
      await page.getByRole('button', { name: /^Pagar/ }).click();
      await expect(
        page.getByText(new RegExp(`${own.name} está agotado`)),
      ).toBeVisible();
      await expect(
        page.getByRole('link', { name: 'Revisar mi carrito' }),
      ).toBeVisible();
      await expect(page.getByText(/agotados o retirados/)).toBeVisible();
      await expect(page.getByRole('button', { name: /^Pagar/ })).toBeDisabled();
    } finally {
      await request.post(`${MOCK}/__mock/menu`, {
        data: { sku: own.sku, restore: true },
      });
    }
  });
});
