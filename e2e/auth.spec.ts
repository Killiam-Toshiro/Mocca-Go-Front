import { expect, test } from '@playwright/test';
import { errorAlert, login, PASSWORD, ROLES } from './helpers';

test.describe('inicio de sesión por rol', () => {
  for (const role of ROLES) {
    test(`${role.identifier} llega a ${role.home}`, async ({ page }) => {
      await login(page, role.identifier, role.home);
      await expect(page.getByRole('heading', { level: 1 })).toContainText(
        'Hola,',
      );
      await expect(page.getByText(role.label).first()).toBeVisible();
    });
  }

  test('contraseña incorrecta: avisa y se queda en /login', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Usuario o correo').fill('operador');
    await page.getByLabel('Contraseña', { exact: true }).fill('incorrecta-123');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(errorAlert(page)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByLabel('Usuario o correo')).toHaveValue('operador');
    await expect(page.getByLabel('Contraseña', { exact: true })).toHaveValue(
      '',
    );
  });

  test('demasiados intentos (429): mensaje claro', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Usuario o correo').fill('limitado');
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(errorAlert(page)).toBeVisible();
    await expect(page).toHaveURL(/\/login$/);
  });

  test('campos vacíos: errores junto a cada campo, sin llamar al servidor', async ({
    page,
  }) => {
    let calls = 0;
    page.on('request', (request) => {
      if (request.url().includes('/api/auth/login')) calls += 1;
    });
    await page.goto('/login');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page.getByText('Escribe tu usuario o correo.')).toBeVisible();
    expect(calls).toBe(0);
  });
});

test.describe('salir y rutas protegidas', () => {
  test('Salir lleva a /login y /admin vuelve a pedir ingreso', async ({
    page,
  }) => {
    await login(page, 'admin', '/admin');
    await page.getByRole('button', { name: 'Salir' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
  });

  test('sin sesión, /admin pide ingreso y después vuelve a /admin', async ({
    page,
  }) => {
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login\?next=%2Fadmin$/);
    await page.getByLabel('Usuario o correo').fill('admin');
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page).toHaveURL(/\/admin$/);
  });

  test('rol equivocado: el operador no entra a /admin y vuelve a su panel', async ({
    page,
  }) => {
    await login(page, 'operador', '/operador');
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/operador$/);
  });

  test('con sesión, /login y /registro llevan al panel', async ({ page }) => {
    await login(page, 'repartidor', '/repartidor');
    await page.goto('/login');
    await expect(page).toHaveURL(/\/repartidor$/);
    await page.goto('/registro');
    await expect(page).toHaveURL(/\/repartidor$/);
  });

  test('un destino externo en `next` se ignora', async ({ page }) => {
    await page.goto('/login?next=https%3A%2F%2Fevil.example');
    await page.getByLabel('Usuario o correo').fill('cliente@example.com');
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page).toHaveURL(/\/cliente$/);
  });
});

test.describe('sesión vencida o inválida', () => {
  test('al vencer la sesión se pasa a /login?expired=1', async ({ page }) => {
    await login(page, 'corta', '/operador');
    await expect(page).toHaveURL(/\/login\?expired=1/, { timeout: 15_000 });
    await expect(page.getByText('Tu sesión venció.')).toBeVisible();
    // Con la sesión vencida, la ruta protegida vuelve a pedir ingreso.
    await page.goto('/operador');
    await expect(page).toHaveURL(/\/login\?next=%2Foperador$/);
  });

  test('sesión muerta en el back: una sola redirección, sin bucle', async ({
    page,
    context,
    baseURL,
  }) => {
    await context.addCookies([
      {
        name: 'session',
        value: 'token-que-el-back-no-conoce',
        url: baseURL!,
        httpOnly: true,
        sameSite: 'Lax',
      },
      {
        name: 'session_exp',
        value: String(Date.now() + 10 * 60_000),
        url: baseURL!,
        sameSite: 'Lax',
      },
    ]);
    const navigations: string[] = [];
    page.on('framenavigated', (frame) => {
      if (frame === page.mainFrame()) navigations.push(frame.url());
    });
    await page.goto('/admin');
    await expect(page).toHaveURL(/\/login\?expired=1/);
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeVisible();
    await page.waitForTimeout(1_000);
    expect(navigations.length).toBeLessThanOrEqual(4);
    const cookies = await context.cookies();
    expect(cookies.find((c) => c.name === 'session')).toBeUndefined();
  });
});

test.describe('registro', () => {
  test('cuenta nueva: entra como cliente', async ({ page }) => {
    await page.goto('/registro');
    await page.getByLabel('Correo').fill(`nuevo-${Date.now()}@example.com`);
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Nombre completo').fill('Ana Prueba');
    await page.getByLabel('Celular').fill('3001234567');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page).toHaveURL(/\/cliente$/);
  });

  test('correo repetido (409): el aviso queda bajo el campo correo', async ({
    page,
  }) => {
    await page.goto('/registro');
    await page.getByLabel('Correo').fill('ocupado@example.com');
    await page.getByLabel('Contraseña', { exact: true }).fill(PASSWORD);
    await page.getByLabel('Nombre completo').fill('Ana Prueba');
    await page.getByLabel('Celular').fill('3001234567');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(page.getByLabel('Correo')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await expect(page).toHaveURL(/\/registro$/);
  });

  test('contraseña corta: la valida el formulario', async ({ page }) => {
    await page.goto('/registro');
    await page.getByLabel('Correo').fill('a@example.com');
    await page.getByLabel('Contraseña', { exact: true }).fill('corta');
    await page.getByLabel('Nombre completo').fill('Ana Prueba');
    await page.getByLabel('Celular').fill('3001234567');
    await page.getByRole('button', { name: 'Crear cuenta' }).click();
    await expect(
      page.getByText('La contraseña debe tener al menos 12 caracteres.'),
    ).toBeVisible();
  });
});
