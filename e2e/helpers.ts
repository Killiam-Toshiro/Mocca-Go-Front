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
