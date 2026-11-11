import { expect, test } from '@playwright/test';
import { login, newCustomerSession } from './helpers';
import { API, createStaff, GENERIC, uid } from './users-helpers';

const NEXT = 'Otra-Clave-98765';

test.describe('mi cuenta (personal)', () => {
  test('visitante al login; un cliente a su panel (CA-17)', async ({
    page,
  }) => {
    await page.goto('/operador/cuenta');
    await expect(page).toHaveURL(/\/login/);
    await newCustomerSession(page);
    await page.goto('/operador/cuenta');
    await expect(page).toHaveURL(/\/cliente$/);
  });

  for (const role of ['admin', 'operador', 'repartidor'] as const) {
    test(`${role}: ve «Mi cuenta» en su navegación y sus datos (CA-17)`, async ({
      page,
      request,
    }) => {
      const user = await createStaff(request, {
        username: `e2e.${role}.${uid()}`,
        role,
      });
      await login(page, user.username, `/${role}`);
      const menu = page.getByRole('button', { name: 'Abrir menú' });
      if (await menu.isVisible()) await menu.click();
      await page.getByRole('link', { name: 'Mi cuenta' }).first().click();
      await expect(page).toHaveURL(new RegExp(`/${role}/cuenta$`));
      await expect(
        page.getByRole('heading', { name: 'Mi cuenta', level: 1 }),
      ).toBeVisible();
      await expect(
        page.locator('#contenido').getByText(user.username),
      ).toBeVisible();
    });
  }

  test('cambia la clave genérica por una propia y la anterior deja de servir (CA-17)', async ({
    page,
    request,
  }) => {
    const user = await createStaff(request, {
      username: `e2e.pass.${uid()}`,
      password: GENERIC,
    });
    await login(page, user.username, /\/operador$/, GENERIC);
    await page.goto('/operador/cuenta');
    await page.getByLabel('Contraseña actual').fill(GENERIC);
    await page.getByLabel('Contraseña nueva', { exact: true }).fill(NEXT);
    await page.getByLabel('Repite la contraseña nueva').fill(NEXT);
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
    await expect(page.getByText(/Cambiamos tu contraseña/)).toBeVisible();

    const old = await request.post(`${API}/auth/login`, {
      data: { username: user.username, password: GENERIC },
    });
    expect(old.status()).toBe(401);
    const fresh = await request.post(`${API}/auth/login`, {
      data: { username: user.username, password: NEXT },
    });
    expect(fresh.status()).toBe(200);
  });

  test('una contraseña actual incorrecta se explica en su campo y no cierra la sesión (CA-17)', async ({
    page,
    request,
  }) => {
    const user = await createStaff(request, { username: `e2e.bad.${uid()}` });
    await login(page, user.username, /\/operador$/);
    await page.goto('/operador/cuenta');
    await page.getByLabel('Contraseña actual').fill('Incorrecta-12345');
    await page.getByLabel('Contraseña nueva', { exact: true }).fill(NEXT);
    await page.getByLabel('Repite la contraseña nueva').fill(NEXT);
    await page.getByRole('button', { name: 'Cambiar contraseña' }).click();
    await expect(
      page.getByText('La contraseña actual no es correcta.').first(),
    ).toBeVisible();
    await expect(page).toHaveURL(/\/operador\/cuenta$/);
    await page.goto('/operador');
    await expect(page).toHaveURL(/\/operador$/);
  });
});
