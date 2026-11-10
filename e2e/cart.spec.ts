import { expect, test, type APIRequestContext } from '@playwright/test';
import { login } from './helpers';

const MOCK = 'http://127.0.0.1:4010';

// Desktop y móvil corren en paralelo contra el mismo mock: cada proyecto toca su propio producto.
const PRODUCTS = {
  desktop: { sku: 'CAF-LATT', name: 'Latte', price: 5000 },
  'mobile-360': { sku: 'CAF-MOCC', name: 'Mocca', price: 5500 },
} as const;

function mine(projectName: string) {
  return PRODUCTS[projectName as keyof typeof PRODUCTS];
}

async function patchMenu(
  request: APIRequestContext,
  body: Record<string, unknown>,
) {
  const res = await request.post(`${MOCK}/__mock/menu`, { data: body });
  expect(res.status()).toBe(204);
}

test.describe('carrito', () => {
  test('un visitante arma su carrito, sobrevive a recargar y puede vaciarlo', async ({
    page,
  }, testInfo) => {
    const p = mine(testInfo.project.name);
    await page.goto('/');
    const add = page.getByRole('button', {
      name: `Agregar ${p.name} al carrito`,
    });
    await add.click();
    await add.click();
    await page.getByRole('button', { name: /Abrir carrito, 2/ }).click();
    const panel = page.getByRole('dialog', { name: 'Tu carrito' });
    await expect(panel.getByText(p.name)).toBeVisible();
    await expect(
      panel.getByText('Precio informativo', { exact: false }),
    ).toBeVisible();
    await panel.getByRole('button', { name: 'Cerrar' }).click();

    await page.reload();
    await expect(
      page.getByRole('button', { name: /Abrir carrito, 2/ }),
    ).toBeVisible();

    await page.getByRole('button', { name: /Abrir carrito/ }).click();
    await page.getByRole('button', { name: 'Vaciar carrito' }).click();
    await page.getByRole('button', { name: 'Sí, vaciar' }).click();
    await expect(page.getByText('Tu carrito está vacío.')).toBeVisible();
  });

  test('el carrito sobrevive al inicio de sesión y se vacía al salir', async ({
    page,
  }, testInfo) => {
    const p = mine(testInfo.project.name);
    await page.goto('/');
    await page
      .getByRole('button', { name: `Agregar ${p.name} al carrito` })
      .click();
    await page.getByRole('button', { name: /Abrir carrito/ }).click();
    await page.getByRole('link', { name: 'Ingresar para pedir' }).click();
    await expect(page).toHaveURL(
      /\/login\?next=%2Fcliente%2Fmenu|\/login\?next=\/cliente\/menu/,
    );

    await page.getByLabel('Usuario o correo').fill('cliente@example.com');
    await page
      .getByLabel('Contraseña', { exact: true })
      .fill('Password-123456');
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page).toHaveURL(/\/cliente\/menu/);
    await expect(
      page.getByRole('button', { name: /Abrir carrito, 1/ }),
    ).toBeVisible();

    await page.getByRole('button', { name: /Abrir carrito/ }).click();
    // Con sesión de cliente, «Continuar» lleva a la página de pedido (spec 003).
    await expect(page.getByRole('link', { name: 'Continuar' })).toHaveAttribute(
      'href',
      '/cliente/pedido',
    );
    await page.getByRole('button', { name: 'Cerrar' }).click();

    // «Salir» está en la cabecera (escritorio) o dentro del menú móvil.
    const salir = page.getByRole('button', { name: 'Salir' });
    if (!(await salir.isVisible())) {
      await page.getByRole('button', { name: 'Abrir menú' }).click();
    }
    await salir.click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto('/');
    await expect(
      page.getByRole('button', { name: /Abrir carrito, \d/ }),
    ).toHaveCount(0);
  });

  test('un producto que se agota queda marcado y bloquea el total', async ({
    page,
    request,
  }, testInfo) => {
    const p = mine(testInfo.project.name);
    await page.goto('/');
    await page
      .getByRole('button', { name: `Agregar ${p.name} al carrito` })
      .click();
    await patchMenu(request, { sku: p.sku, available: false });
    try {
      await page.reload();
      await page.getByRole('button', { name: /Abrir carrito/ }).click();
      const panel = page.getByRole('dialog', { name: 'Tu carrito' });
      await expect(
        panel.getByText(/Agotado: no cuenta en el total/),
      ).toBeVisible();
      await expect(
        panel.getByText(/Quita los productos agotados/),
      ).toBeVisible();
    } finally {
      await patchMenu(request, { sku: p.sku, available: true });
    }
  });

  test('si cambia el precio, el carrito avisa y usa el precio nuevo', async ({
    page,
    request,
  }, testInfo) => {
    const p = mine(testInfo.project.name);
    await page.goto('/');
    await page
      .getByRole('button', { name: `Agregar ${p.name} al carrito` })
      .click();
    await patchMenu(request, { sku: p.sku, price: p.price + 500 });
    try {
      await page.reload();
      await page.getByRole('button', { name: /Abrir carrito/ }).click();
      const panel = page.getByRole('dialog', { name: 'Tu carrito' });
      await expect(panel.getByText(/Cambió el precio de/)).toBeVisible();
      await panel.getByRole('button', { name: 'Entendido' }).click();
      await expect(panel.getByText(/Cambió el precio de/)).toHaveCount(0);
    } finally {
      await patchMenu(request, { sku: p.sku, price: p.price });
    }
  });

  test('un producto retirado se quita con aviso', async ({
    page,
    request,
  }, testInfo) => {
    const p = mine(testInfo.project.name);
    await page.goto('/');
    await page
      .getByRole('button', { name: `Agregar ${p.name} al carrito` })
      .click();
    await patchMenu(request, { sku: p.sku, remove: true });
    try {
      await page.reload();
      await page.getByRole('button', { name: /Abrir carrito/ }).click();
      await expect(
        page.getByText(new RegExp(`${p.name} ya no está en el menú`)),
      ).toBeVisible();
    } finally {
      await patchMenu(request, { sku: p.sku, restore: true });
    }
  });

  test('dos pestañas comparten el carrito', async ({ context }, testInfo) => {
    const p = mine(testInfo.project.name);
    const a = await context.newPage();
    const b = await context.newPage();
    await a.goto('/');
    await b.goto('/');
    await a
      .getByRole('button', { name: `Agregar ${p.name} al carrito` })
      .click();
    await expect(
      b.getByRole('button', { name: /Abrir carrito, 1/ }),
    ).toBeVisible();
  });

  test('personal (admin) ve el menú sin carrito', async ({ page }) => {
    await login(page, 'admin', '/admin');
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Menú' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /carrito/i })).toHaveCount(0);
    await expect(
      page.getByRole('link', { name: 'Ir a mi panel' }),
    ).toBeVisible();
  });
});
