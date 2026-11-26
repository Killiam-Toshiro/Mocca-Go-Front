import { expect, test, type Page } from '@playwright/test';
import { login, newCustomerSession, PASSWORD } from './helpers';

const NEXT = 'Otra-Clave-98765';
const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const phone = (page: Page) => page.getByLabel('Celular', { exact: true });
const save = (page: Page) =>
  page.getByRole('button', { name: 'Guardar cambios' });
const changePassword = (page: Page) =>
  page.getByRole('button', { name: 'Cambiar contraseña' });

async function fillPasswords(page: Page, current: string, next = NEXT) {
  await page.getByLabel('Contraseña actual').fill(current);
  await page.getByLabel('Contraseña nueva', { exact: true }).fill(next);
  await page.getByLabel('Repite la contraseña nueva').fill(next);
}

test.describe('mi perfil: acceso', () => {
  test('un visitante va al login y el personal a su panel (CA-01)', async ({
    page,
  }) => {
    await page.goto('/cliente/perfil');
    await expect(page).toHaveURL(/\/login/);
    await login(page, 'operador', /\/operador$/);
    await page.goto('/cliente/perfil');
    await expect(page).toHaveURL(/\/operador$/);
  });

  test('«Mi perfil» está habilitado en la navegación del cliente', async ({
    page,
  }) => {
    await newCustomerSession(page);
    await page.goto('/cliente');
    // En 360 px la navegación está dentro del menú.
    const menu = page.getByRole('button', { name: 'Abrir menú' });
    if (await menu.isVisible()) await menu.click();
    const link = page.getByRole('link', { name: 'Mi perfil' }).first();
    await expect(link).toBeVisible();
    await link.click();
    await expect(page).toHaveURL(/\/cliente\/perfil$/);
    await expect(
      page.getByRole('heading', { name: 'Mi perfil' }),
    ).toBeVisible();
  });
});

test.describe('mi perfil: datos', () => {
  test('muestra los datos, edita solo lo que cambió y actualiza la cabecera (CA-08, CA-09)', async ({
    page,
  }) => {
    const { email } = await newCustomerSession(page);
    await page.goto('/cliente/perfil');
    await expect(page.getByText(email)).toBeVisible();
    await expect(
      page.getByText('El correo no se puede cambiar.'),
    ).toBeVisible();
    await expect(page.getByLabel('Nombre completo')).toHaveValue(
      'Cliente de Prueba',
    );
    await expect(save(page)).toBeDisabled();

    await page.getByLabel('Nombre completo').fill('Ana María Prueba');
    await phone(page).fill('300 765 4322');
    await save(page).click();
    const status = page.getByText('Guardamos tus cambios.');
    await expect(status).toBeVisible();
    await expect(status).toBeFocused();
    await expect(phone(page)).toHaveValue('+573007654322');
    await expect(save(page)).toBeDisabled();
    // La cabecera usa la misma consulta del perfil.
    await expect(page.getByText('Ana María Prueba').first()).toBeVisible();

    await page.reload();
    await expect(page.getByLabel('Nombre completo')).toHaveValue(
      'Ana María Prueba',
    );
    await expect(phone(page)).toHaveValue('+573007654322');
  });

  test('valida en el front y muestra el 400 del back en el campo', async ({
    page,
  }) => {
    await newCustomerSession(page);
    await page.goto('/cliente/perfil');
    await page.getByLabel('Nombre completo').fill('A');
    await save(page).click();
    await expect(
      page.getByText('El nombre debe tener al menos 2 caracteres.'),
    ).toBeVisible();

    await page.getByLabel('Nombre completo').fill('Cliente de Prueba');
    // Pasa la forma razonable del front, pero el back no lo reconoce como celular.
    await phone(page).fill('1234567');
    await save(page).click();
    await expect(page.getByText(/celular colombiano/)).toBeVisible();
    await expect(phone(page)).toHaveAttribute('aria-invalid', 'true');
  });

  test('un corte de red no reintenta solo y conserva lo escrito (CA-12)', async ({
    page,
  }) => {
    await newCustomerSession(page);
    await page.goto('/cliente/perfil');
    let patches = 0;
    await page.route('**/api/customers/me', (route) => {
      if (route.request().method() !== 'PATCH') return route.continue();
      patches += 1;
      return route.abort('failed');
    });
    await page.getByLabel('Nombre completo').fill('Otro Nombre');
    await save(page).click();
    await expect(
      page.getByText(/No pudimos confirmar el cambio/),
    ).toBeVisible();
    await expect(page.getByLabel('Nombre completo')).toHaveValue('Otro Nombre');
    expect(patches).toBe(1);

    await page.unroute('**/api/customers/me');
    await save(page).click();
    await expect(page.getByText('Guardamos tus cambios.')).toBeVisible();
  });
});

test.describe('mi perfil: contraseña', () => {
  test('la contraseña actual incorrecta es un error del campo y NO cierra la sesión (CA-11)', async ({
    page,
  }) => {
    await newCustomerSession(page);
    await page.goto('/cliente/perfil');
    await fillPasswords(page, 'Incorrecta-12345');
    await changePassword(page).click();
    await expect(
      page.getByText('La contraseña actual no es correcta.'),
    ).toBeVisible();
    await expect(page.getByLabel('Contraseña actual')).toHaveValue('');
    await expect(page.getByLabel('Contraseña actual')).toBeFocused();
    await expect(page).toHaveURL(/\/cliente\/perfil$/);
    // La sesión sigue viva.
    await page.goto('/cliente/pedidos');
    await expect(page).toHaveURL(/\/cliente\/pedidos$/);
  });

  test('valida en el front antes de enviar', async ({ page }) => {
    await newCustomerSession(page);
    await page.goto('/cliente/perfil');
    await fillPasswords(page, PASSWORD, PASSWORD);
    await changePassword(page).click();
    await expect(
      page.getByText('La contraseña nueva debe ser distinta de la actual.'),
    ).toBeVisible();
  });

  test('el cambio mantiene esta sesión, cierra las otras y la nueva sirve para ingresar (CA-10)', async ({
    page,
    browser,
  }) => {
    test.setTimeout(60_000);
    const { email } = await newCustomerSession(page);
    const other = await browser.newContext();
    const otherPage = await other.newPage();
    await login(otherPage, email, /\/cliente$/);

    await page.goto('/cliente/perfil');
    await fillPasswords(page, PASSWORD);
    await changePassword(page).click();
    const status = page.getByText(/Cambiamos tu contraseña/);
    await expect(status).toBeVisible();
    await expect(status).toBeFocused();
    await expect(page.getByLabel('Contraseña actual')).toHaveValue('');
    await expect(
      page.getByLabel('Contraseña nueva', { exact: true }),
    ).toHaveValue('');

    // Esta sesión sigue abierta.
    await page.goto('/cliente/pedidos');
    await expect(page).toHaveURL(/\/cliente\/pedidos$/);
    // La otra sesión cayó: su siguiente consulta privada devuelve 401 y la lleva al login.
    await otherPage.goto('/cliente/pedidos');
    await expect(otherPage).toHaveURL(/\/login/);

    // La contraseña nueva funciona y la vieja no.
    await other.clearCookies();
    await login(otherPage, email, /\/cliente$/, NEXT);
    await other.close();
  });

  test('un corte de red explica las dos posibilidades y vacía los campos', async ({
    page,
  }) => {
    await newCustomerSession(page);
    await page.goto('/cliente/perfil');
    let patches = 0;
    await page.route('**/api/auth/password', (route) => {
      patches += 1;
      return route.abort('failed');
    });
    await fillPasswords(page, PASSWORD);
    await changePassword(page).click();
    await expect(
      page.getByText(/Si la actual ya no te sirve, prueba con la nueva/),
    ).toBeVisible();
    await expect(page.getByLabel('Contraseña actual')).toHaveValue('');
    expect(patches).toBe(1);
  });
});

test.describe('mi perfil: diseño', () => {
  test('sin desborde y con botones de al menos 48 px', async ({ page }) => {
    await newCustomerSession(page);
    await page.goto('/cliente/perfil');
    await expect(
      page.getByRole('heading', { name: 'Cambiar contraseña' }),
    ).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    await page.getByLabel('Nombre completo').fill('Otro Nombre');
    for (const button of [save(page), changePassword(page)]) {
      expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(48);
    }
    await page.screenshot({
      path: `test-results/profile-${String(page.viewportSize()?.width)}.png`,
      fullPage: true,
    });
  });
});
