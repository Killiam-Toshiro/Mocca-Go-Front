import { expect, test, type Locator, type Page } from '@playwright/test';
import { login, newCustomerSession, placeOrder } from './helpers';
import { adminToken, API, uid } from './users-helpers';

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const dialog = (page: Page) => page.getByRole('dialog');
const zoneCard = (page: Page, name: string) =>
  page.getByRole('region', { name, exact: true });
const pointRow = (page: Page, name: string): Locator =>
  page
    .getByRole('heading', { level: 4, name, exact: true })
    .locator('xpath=ancestor::li[1]');

/** Los dos proyectos (escritorio y 360 px) comparten el mismo mock: nombres únicos. */
const names = () => {
  const id = uid();
  return {
    zone: `Zona E2E ${id}`,
    zone2: `Zona E2E B ${id}`,
    point: `Punto E2E ${id}`,
  };
};

async function openZones(page: Page) {
  await login(page, 'admin', '/admin');
  await page.goto('/admin/zonas');
  await expect(
    page.getByRole('heading', { name: 'Zonas y puntos', level: 1 }),
  ).toBeVisible();
}

async function apiCreate(
  page: Page,
  path: string,
  data: Record<string, unknown>,
): Promise<{ id: string }> {
  const token = await adminToken(page.request);
  const res = await page.request.post(`${API}${path}`, {
    headers: { authorization: `Bearer ${token}` },
    data,
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as { id: string };
}

/** Lo que el cliente ve al pagar: opciones del selector «Zona». */
async function checkoutZones(customer: Page): Promise<string[]> {
  await customer.goto('/cliente/menu');
  await customer
    .getByRole('button', { name: 'Agregar Capuchino al carrito' })
    .click();
  await customer.getByRole('button', { name: /Abrir carrito/ }).click();
  await customer.getByRole('link', { name: 'Continuar' }).click();
  const select = customer.getByLabel('Zona');
  await expect(select).toBeVisible();
  return select.locator('option').allTextContents();
}

test.describe('zonas y puntos', () => {
  test('guardas: visitante al login, otros roles a su panel; el admin ve «Zonas y puntos» en su menú', async ({
    page,
  }) => {
    await page.goto('/admin/zonas');
    await expect(page).toHaveURL(/\/login/);
    await login(page, 'operador', /\/operador$/);
    await page.goto('/admin/zonas');
    await expect(page).toHaveURL(/\/operador$/);
    await page.context().clearCookies();
    await login(page, 'admin', '/admin');
    await page.goto('/admin');
    const menu = page.getByRole('button', { name: 'Abrir menú' });
    if (await menu.isVisible()) await menu.click();
    await expect(
      page.getByRole('link', { name: 'Zonas y puntos' }).first(),
    ).toBeVisible();
  });

  test('lista las zonas del seed con sus puntos y estados', async ({
    page,
  }) => {
    await openZones(page);
    await expect(zoneCard(page, 'Zona 1')).toBeVisible();
    await expect(pointRow(page, 'Edificio A')).toContainText('4 pisos');
    await expect(pointRow(page, 'Edificio A')).toContainText('Activo');
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test('flujo: crear zona y punto, validar, renombrar, editar, mover; el cliente lo ve al pagar y deja de verlo al desactivar', async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const n = names();
    await openZones(page);

    // Crear zona: vacío, nombre válido y nombre repetido.
    await page.getByRole('button', { name: 'Crear zona' }).click();
    await dialog(page).getByRole('button', { name: 'Crear zona' }).click();
    await expect(
      dialog(page).getByText('El nombre debe tener entre 1 y 60 caracteres.'),
    ).toBeVisible();
    await dialog(page).getByLabel('Nombre de la zona').fill(n.zone);
    await dialog(page).getByRole('button', { name: 'Crear zona' }).click();
    await expect(page.getByText(`Creamos la zona ${n.zone}.`)).toBeVisible();
    await expect(zoneCard(page, n.zone)).toContainText('Sin puntos todavía');

    await page.getByRole('button', { name: 'Crear zona' }).click();
    await dialog(page)
      .getByLabel('Nombre de la zona')
      .fill(n.zone.toLowerCase());
    await dialog(page).getByRole('button', { name: 'Crear zona' }).click();
    await expect(
      dialog(page).getByText('Ya existe una zona con ese nombre.'),
    ).toBeVisible();
    await page.keyboard.press('Escape');

    // Agregar punto con indicación y pisos; nombre repetido en otra zona.
    await page
      .getByRole('button', { name: `Agregar punto a ${n.zone}` })
      .click();
    await dialog(page).getByLabel('Nombre del punto').fill('Edificio A');
    await dialog(page).getByRole('button', { name: 'Agregar punto' }).click();
    await expect(
      dialog(page).getByText('Ya existe un punto con ese nombre.'),
    ).toBeVisible();
    await dialog(page).getByLabel('Nombre del punto').fill(n.point);
    await dialog(page)
      .getByLabel(/Indicación/)
      .fill('Entrada lateral');
    await dialog(page).getByLabel('Este lugar tiene pisos').check();
    await dialog(page).getByLabel('Número de pisos').fill('31');
    await dialog(page).getByRole('button', { name: 'Agregar punto' }).click();
    await expect(
      dialog(page).getByText('Los pisos son un número entero de 1 a 30.'),
    ).toBeVisible();
    await dialog(page).getByLabel('Número de pisos').fill('3');
    await dialog(page).getByRole('button', { name: 'Agregar punto' }).click();
    await expect(
      page.getByText(`Agregamos el punto ${n.point}.`),
    ).toBeVisible();
    await expect(pointRow(page, n.point)).toContainText(
      '3 pisos · Entrada lateral',
    );
    expect(await overflow(page)).toBeLessThanOrEqual(0);

    // Editar: sin pisos y sin indicación.
    await page.getByRole('button', { name: `Editar ${n.point}` }).click();
    await dialog(page)
      .getByLabel(/Indicación/)
      .fill('');
    await dialog(page).getByLabel('Este lugar tiene pisos').uncheck();
    await dialog(page).getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(pointRow(page, n.point)).toContainText('Sin pisos');
    await expect(pointRow(page, n.point)).not.toContainText('Entrada lateral');

    // El cliente ve la zona nueva al pagar.
    const customer = await browser.newContext();
    const cp = await customer.newPage();
    try {
      await newCustomerSession(cp);
      expect(await checkoutZones(cp)).toContain(n.zone);

      // Mover el punto a otra zona nueva y renombrar la primera.
      await page.getByRole('button', { name: 'Crear zona' }).click();
      await dialog(page).getByLabel('Nombre de la zona').fill(n.zone2);
      await dialog(page).getByRole('button', { name: 'Crear zona' }).click();
      await expect(zoneCard(page, n.zone2)).toBeVisible();
      await page.getByRole('button', { name: `Editar ${n.point}` }).click();
      await dialog(page).getByLabel('Zona').selectOption({ label: n.zone2 });
      await dialog(page)
        .getByRole('button', { name: 'Guardar cambios' })
        .click();
      await expect(
        zoneCard(page, n.zone2).getByRole('heading', {
          level: 4,
          name: n.point,
        }),
      ).toBeVisible();
      await expect(zoneCard(page, n.zone)).toContainText('Sin puntos todavía');

      // Desactivar el punto (con confirmación): el cliente deja de ver la zona.
      await page.getByRole('button', { name: `Desactivar ${n.point}` }).click();
      await page.getByRole('button', { name: 'Cancelar' }).click();
      await expect(pointRow(page, n.point)).toContainText('Activo');
      await page.getByRole('button', { name: `Desactivar ${n.point}` }).click();
      await page.getByRole('button', { name: 'Sí, desactivar' }).click();
      await expect(pointRow(page, n.point)).toContainText('Inactivo');
      expect(await checkoutZones(cp)).not.toContain(n.zone2);

      // Limpieza: eliminar punto y zonas creadas.
      await page.getByRole('button', { name: `Eliminar ${n.point}` }).click();
      await page.getByRole('button', { name: 'Sí, eliminar' }).click();
      await expect(
        page.getByText(`Eliminamos el punto ${n.point}.`),
      ).toBeVisible();
      for (const zone of [n.zone, n.zone2]) {
        await page
          .getByRole('button', { name: `Eliminar la zona ${zone}` })
          .click();
        await page.getByRole('button', { name: 'Sí, eliminar' }).click();
        await expect(
          page.getByText(`Eliminamos la zona ${zone}.`),
        ).toBeVisible();
      }
    } finally {
      await customer.close();
    }
  });

  test('un punto con pedidos no se elimina: el 409 del back se explica y se ofrece desactivar', async ({
    page,
    browser,
  }) => {
    test.setTimeout(120_000);
    const n = names();
    const zone = await apiCreate(page, '/delivery-zones', { name: n.zone });
    await apiCreate(page, '/delivery-points', {
      zoneId: zone.id,
      name: n.point,
    });
    const customer = await browser.newContext();
    const cp = await customer.newPage();
    try {
      await newCustomerSession(cp);
      await placeOrder(cp, { zone: n.zone, point: n.point });
      await openZones(page);
      await page.getByRole('button', { name: `Eliminar ${n.point}` }).click();
      await page.getByRole('button', { name: 'Sí, eliminar' }).click();
      await expect(
        page.getByText(
          'El punto tiene pedidos; desactívalo en vez de eliminarlo.',
        ),
      ).toBeVisible();
      await expect(pointRow(page, n.point)).toBeVisible();
      await pointRow(page, n.point)
        .getByRole('button', { name: 'Desactivar' })
        .first()
        .click();
      await page.getByRole('button', { name: 'Sí, desactivar' }).click();
      await expect(pointRow(page, n.point)).toContainText('Inactivo');
      expect(await overflow(page)).toBeLessThanOrEqual(0);
    } finally {
      await customer.close();
    }
  });

  test('un corte de red al crear una zona no la duplica: se confirma consultando', async ({
    page,
  }) => {
    const n = names();
    await openZones(page);
    let first = true;
    await page.route('**/api/delivery-zones', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      if (first) {
        first = false;
        // Se aplica en el back, pero la respuesta no llega.
        await route.fetch();
        return route.abort('failed');
      }
      return route.continue();
    });
    await page.getByRole('button', { name: 'Crear zona' }).click();
    await dialog(page).getByLabel('Nombre de la zona').fill(n.zone);
    await dialog(page).getByRole('button', { name: 'Crear zona' }).click();
    await expect(page.getByText(`Creamos la zona ${n.zone}.`)).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: n.zone }),
    ).toHaveCount(1);
    await page
      .getByRole('button', { name: `Eliminar la zona ${n.zone}` })
      .click();
    await page.getByRole('button', { name: 'Sí, eliminar' }).click();
    await expect(page.getByText(`Eliminamos la zona ${n.zone}.`)).toBeVisible();
  });

  test('los botones principales miden al menos 48 px y no hay desborde', async ({
    page,
  }) => {
    await openZones(page);
    for (const button of [
      page.getByRole('button', { name: 'Crear zona' }),
      page.getByRole('button', { name: 'Renombrar Zona 1' }),
      page.getByRole('button', { name: 'Editar Edificio A' }),
      page.getByRole('button', { name: 'Desactivar Edificio A' }),
    ]) {
      const box = await button.boundingBox();
      expect(box?.height ?? 0).toBeGreaterThanOrEqual(47);
    }
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });
});
