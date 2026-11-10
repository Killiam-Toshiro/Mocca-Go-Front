import { expect, type Locator, type Page } from '@playwright/test';

/** Contraseña de todos los usuarios del servidor simulado (`tests/mock-api`). */
export const PASSWORD = 'Password-123456';

/** Inicia sesión por la interfaz y espera a llegar a `home`. */
export async function login(
  page: Page,
  identifier: string,
  home: string | RegExp,
  password = PASSWORD,
): Promise<void> {
  await page.goto('/login');
  await page.getByLabel('Usuario o correo').fill(identifier);
  await page.getByLabel('Contraseña', { exact: true }).fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await expect(page).toHaveURL(home);
}

/** Cada usuario del mock con el panel al que debe llegar. */
export const ROLES = [
  { identifier: 'admin', home: '/admin', label: 'Administrador' },
  { identifier: 'operador', home: '/operador', label: 'Operador' },
  { identifier: 'repartidor', home: '/repartidor', label: 'Repartidor' },
  { identifier: 'cliente@example.com', home: '/cliente', label: 'Cliente' },
] as const;

/** Aviso de error del formulario (excluye el anunciador de rutas de Next, que también es `role=alert`). */
export function errorAlert(page: Page): Locator {
  return page.locator('[role="alert"]:not(#__next-route-announcer__)');
}

const MOCK_API = 'http://127.0.0.1:4010/api/v1';

/**
 * Crea un cliente nuevo directamente en el mock e inicia sesión por la interfaz.
 * Cada prueba tiene su propio cliente: los pedidos no se mezclan entre escritorio y móvil.
 */
export async function newCustomerSession(
  page: Page,
): Promise<{ email: string }> {
  const email = `cliente-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
  const res = await page.request.post(`${MOCK_API}/customers`, {
    data: {
      email,
      password: PASSWORD,
      fullName: 'Cliente de Prueba',
      phone: '3001234567',
    },
  });
  expect(res.status()).toBe(201);
  await login(page, email, /\/cliente$/);
  return { email };
}

/** Hace un pedido de un capuchino con el flujo real; devuelve su id y su número. */
export async function placeOrder(
  page: Page,
): Promise<{ id: string; number: number }> {
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
  const id = /pedidos\/([0-9a-f-]{36})/.exec(page.url())![1]!;
  const heading = await page
    .getByRole('heading', { name: /^Pedido #\d+$/ })
    .textContent();
  return { id, number: Number(/#(\d+)/.exec(heading ?? '')![1]) };
}
