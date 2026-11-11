import {
  expect,
  test,
  type APIRequestContext,
  type Browser,
  type Page,
} from '@playwright/test';
import { login, newCustomerSession, placeOrder } from './helpers';

const MOCK = 'http://127.0.0.1:4010';
const DISPATCH_STREAM = '**/api/dispatch/stream';

/**
 * Cada proyecto (escritorio y 360 px) corre en paralelo contra el mismo mock: cada uno usa su propio
 * repartidor y solo ve sus propios pedidos (`scope` del mock), así no se pisan ni con la cocina.
 */
const COURIER = {
  desktop: { username: 'repartidor', id: 'u-repartidor', name: 'Carlos Gómez' },
  'mobile-360': {
    username: 'repartidor2',
    id: 'u-repartidor-2',
    name: 'Laura Ríos',
  },
} as const;
const mine = (project: string) => COURIER[project as keyof typeof COURIER];

interface Ready {
  id: string;
  number: number;
  page: Page;
  close: () => Promise<void>;
}

/** Un cliente nuevo hace un pedido (en la zona indicada) y la cocina lo deja `listo`. */
async function readyOrder(
  browser: Browser,
  request: APIRequestContext,
  where?: { zone: string; point: string },
  status: 'listo' | 'recibido' = 'listo',
): Promise<Ready> {
  const context = await browser.newContext();
  const page = await context.newPage();
  await newCustomerSession(page);
  const order = await placeOrder(page, where);
  if (status === 'listo')
    await request.post(`${MOCK}/__mock/orders/${order.id}/status`, {
      data: { status: 'listo' },
    });
  return { ...order, page, close: () => context.close() };
}

const scope = (request: APIRequestContext, courier: string, ids: string[]) =>
  request.post(`${MOCK}/__mock/dispatch`, { data: { courier, scope: ids } });

async function finishAll(request: APIRequestContext, orders: Ready[]) {
  for (const o of orders)
    await request.post(`${MOCK}/__mock/orders/${o.id}/status`, {
      data: { status: 'entregado' },
    });
}

const ZONE2 = { zone: 'Zona 2', point: 'Cafetería' };
const zone = (page: Page, name: string) =>
  page.getByRole('region', { name: new RegExp(name) });
const article = (page: Page, number: number) =>
  page.getByRole('article', { name: `Pedido #${String(number)}` });

test.describe('repartidor', () => {
  test.beforeEach(async ({ request }, testInfo) => {
    const me = mine(testInfo.project.name);
    await request.post(`${MOCK}/__mock/dispatch`, {
      data: { courier: me.id, profile: 'completo', scope: [] },
    });
  });

  test('guardas: visitante, cliente y repartidor', async ({
    page,
    browser,
  }, testInfo) => {
    await page.goto('/repartidor/cola');
    await expect(page).toHaveURL(/\/login/);

    const customer = await browser.newContext();
    const customerPage = await customer.newPage();
    await newCustomerSession(customerPage);
    await customerPage.goto('/repartidor/rondas');
    await expect(customerPage).toHaveURL(/\/cliente$/);
    await customer.close();

    await login(page, mine(testInfo.project.name).username, '/repartidor');
    for (const [path, title] of [
      ['/repartidor/cola', 'Cola de despacho'],
      ['/repartidor/rondas', 'Mis rondas'],
    ] as const) {
      await page.goto(path);
      await expect(
        page.getByRole('heading', { name: title, level: 1 }),
      ).toBeVisible();
    }
  });

  test('flujo: elegir, salir, entregar, no entregar y el cliente lo ve en vivo', async ({
    page,
    browser,
    request,
  }, testInfo) => {
    test.setTimeout(90_000);
    const me = mine(testInfo.project.name);
    const a = await readyOrder(browser, request);
    const b = await readyOrder(browser, request);
    const c = await readyOrder(browser, request, ZONE2);
    await scope(request, me.id, [a.id, b.id, c.id]);
    try {
      await login(page, me.username, '/repartidor');
      await page.goto('/repartidor/cola');

      await expect(zone(page, 'Zona 1')).toContainText(
        'Sugerida: lleva el pedido más antiguo',
      );
      await expect(zone(page, 'Zona 1')).toContainText(
        `Pedido #${String(a.number)}`,
      );
      await expect(zone(page, 'Zona 2')).toContainText(
        `Pedido #${String(c.number)}`,
      );

      // Ruta propia: A (Zona 1); la otra zona queda bloqueada.
      await page
        .getByRole('checkbox', { name: `Elegir pedido #${String(a.number)}` })
        .check();
      await expect(
        page.getByRole('checkbox', {
          name: `Elegir pedido #${String(c.number)}`,
        }),
      ).toBeDisabled();
      await expect(zone(page, 'Zona 2')).toContainText(
        'Una ronda es de una sola zona',
      );
      await page.getByRole('button', { name: 'Salir con 1 pedido' }).click();
      await expect(page).toHaveURL(/\/repartidor\/rondas$/);
      await expect(article(page, a.number)).toBeVisible();

      // El cliente de A ve «En camino» con su repartidor.
      await expect(a.page.getByText(me.name)).toBeVisible({ timeout: 5_000 });
      await expect(a.page.getByText(/Llegada estimada/)).toBeVisible();

      // Entregar A con confirmación; al ser el único pedido, la ronda termina.
      await page
        .getByRole('button', {
          name: `Entregado #${String(a.number)}`,
          exact: true,
        })
        .click();
      await page
        .getByRole('button', {
          name: `Sí, entregado el pedido ${String(a.number)}`,
        })
        .click();
      await expect(page.getByRole('status')).toContainText(
        'Ronda terminada: 1 entregado, 0 no entregados',
      );
      await expect(page.getByText('No tienes rondas activas.')).toBeVisible();
      await expect(
        a.page
          .getByRole('list', { name: 'Historial del pedido' })
          .getByText('Entregado'),
      ).toBeVisible({ timeout: 5_000 });

      // «Salir con la sugerencia»: la zona del pedido más antiguo que queda (B).
      await page.goto('/repartidor/cola');
      await page
        .getByRole('button', { name: 'Salir con la sugerencia' })
        .click();
      await expect(page).toHaveURL(/\/repartidor\/rondas$/);
      await expect(article(page, b.number)).toBeVisible();
      await page
        .getByRole('button', {
          name: `No entregado #${String(b.number)}`,
          exact: true,
        })
        .click();
      await page
        .getByRole('button', {
          name: `Confirmar no entrega del pedido ${String(b.number)}`,
        })
        .click();
      await expect(
        page.getByText('Escribe el motivo por el que no se entregó.'),
      ).toBeVisible();
      await page
        .getByRole('button', { name: 'No contestó el teléfono' })
        .click();
      await page
        .getByRole('button', {
          name: `Confirmar no entrega del pedido ${String(b.number)}`,
        })
        .click();
      await expect(page.getByRole('status')).toContainText(
        'Ronda terminada: 0 entregados, 1 no entregado',
      );
      await expect(
        b.page.getByText(
          'No pudimos entregar tu pedido: No contestó el teléfono',
        ),
      ).toBeVisible({ timeout: 5_000 });
    } finally {
      await finishAll(request, [a, b, c]);
      await Promise.all([a.close(), b.close(), c.close()]);
    }
  });

  test('en vivo: un pedido que la cocina marca listo aparece en la cola con su aviso', async ({
    page,
    browser,
    request,
  }, testInfo) => {
    const me = mine(testInfo.project.name);
    const o = await readyOrder(browser, request, undefined, 'recibido');
    await scope(request, me.id, [o.id]);
    try {
      await login(page, me.username, '/repartidor');
      await page.goto('/repartidor/cola');
      await expect(
        page.getByText('No hay pedidos listos para repartir.'),
      ).toBeVisible();
      await request.post(`${MOCK}/__mock/orders/${o.id}/status`, {
        data: { status: 'listo' },
      });
      await expect(
        article(page, o.number).or(zone(page, 'Zona 1')),
      ).toBeVisible({
        timeout: 4_000,
      });
      await expect(zone(page, 'Zona 1')).toContainText(
        `Pedido #${String(o.number)}`,
      );
      await expect(
        page.getByText(`Pedido #${String(o.number)} listo para repartir`),
      ).toHaveCount(1);
    } finally {
      await finishAll(request, [o]);
      await o.close();
    }
  });

  test('si otro repartidor toma el pedido, el 409 se explica y la cola se actualiza', async ({
    page,
    browser,
    request,
  }, testInfo) => {
    const me = mine(testInfo.project.name);
    const o = await readyOrder(browser, request);
    await scope(request, me.id, [o.id]);
    // Sin canal en vivo: la pantalla no se entera hasta que se equivoca (sondeo de 15 s).
    await page.route(DISPATCH_STREAM, (route) =>
      route.fulfill({
        status: 403,
        contentType: 'application/json',
        body: '{}',
      }),
    );
    try {
      await login(page, me.username, '/repartidor');
      await page.goto('/repartidor/cola');
      await page
        .getByRole('checkbox', { name: `Elegir pedido #${String(o.number)}` })
        .check();
      await request.post(`${MOCK}/__mock/dispatch`, {
        data: { foreign: [o.id] },
      });
      await page.getByRole('button', { name: 'Salir con 1 pedido' }).click();
      await expect(
        page.getByText(
          `Los pedidos #${String(o.number)} ya no están listos (otro repartidor los tomó o cambiaron); se actualizó la cola.`,
        ),
      ).toBeVisible();
      await expect(page).toHaveURL(/\/repartidor\/cola$/);
      await expect(
        page.getByText('No hay pedidos listos para repartir.'),
      ).toBeVisible();
      await page.getByRole('button', { name: 'Entendido' }).click();
    } finally {
      await finishAll(request, [o]);
      await o.close();
    }
  });

  test('un corte de red al salir no se reintenta y dice que la ronda no salió', async ({
    page,
    browser,
    request,
  }, testInfo) => {
    const me = mine(testInfo.project.name);
    const o = await readyOrder(browser, request);
    await scope(request, me.id, [o.id]);
    let posts = 0;
    await page.route('**/api/dispatch/rounds', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      posts += 1;
      await route.abort('connectionreset');
    });
    try {
      await login(page, me.username, '/repartidor');
      await page.goto('/repartidor/cola');
      await page
        .getByRole('button', { name: 'Salir con la sugerencia' })
        .click();
      await expect(
        page.getByText('La ronda no salió: puedes intentar de nuevo.'),
      ).toBeVisible();
      await page.waitForTimeout(500);
      expect(posts).toBe(1);
      await expect(page).toHaveURL(/\/repartidor\/cola$/);
    } finally {
      await finishAll(request, [o]);
      await o.close();
    }
  });

  test('perfil incompleto: el 409 se explica con la frase propia', async ({
    page,
    browser,
    request,
  }, testInfo) => {
    const me = mine(testInfo.project.name);
    const o = await readyOrder(browser, request);
    await scope(request, me.id, [o.id]);
    await request.post(`${MOCK}/__mock/dispatch`, {
      data: { courier: me.id, profile: 'incompleto' },
    });
    try {
      await login(page, me.username, '/repartidor');
      await page.goto('/repartidor/cola');
      await page
        .getByRole('button', { name: 'Salir con la sugerencia' })
        .click();
      await expect(
        page.getByText(
          'Falta tu nombre o teléfono en el perfil: pídele al administrador que los complete.',
        ),
      ).toBeVisible();
    } finally {
      await request.post(`${MOCK}/__mock/dispatch`, {
        data: { courier: me.id, profile: 'completo' },
      });
      await finishAll(request, [o]);
      await o.close();
    }
  });

  test('diseño: sin desborde horizontal y botones de al menos 48 px', async ({
    page,
    browser,
    request,
  }, testInfo) => {
    const me = mine(testInfo.project.name);
    const a = await readyOrder(browser, request);
    const b = await readyOrder(browser, request);
    await scope(request, me.id, [a.id, b.id]);
    try {
      await login(page, me.username, '/repartidor');
      await page.goto('/repartidor/cola');
      await expect(zone(page, 'Zona 1')).toBeVisible();
      const overflow = () =>
        page.evaluate(
          () => document.documentElement.scrollWidth - window.innerWidth,
        );
      expect(await overflow()).toBeLessThanOrEqual(0);
      const suggested = page.getByRole('button', {
        name: 'Salir con la sugerencia',
      });
      expect((await suggested.boundingBox())!.height).toBeGreaterThanOrEqual(
        48,
      );
      const row = page
        .getByRole('checkbox', { name: `Elegir pedido #${String(a.number)}` })
        .locator('xpath=ancestor::label[1]');
      expect((await row.boundingBox())!.height).toBeGreaterThanOrEqual(48);

      await suggested.click();
      await expect(page).toHaveURL(/\/repartidor\/rondas$/);
      await expect(article(page, a.number)).toBeVisible();
      expect(await overflow()).toBeLessThanOrEqual(0);
      const deliver = page.getByRole('button', {
        name: `Entregado #${String(a.number)}`,
        exact: true,
      });
      expect((await deliver.boundingBox())!.height).toBeGreaterThanOrEqual(48);
      const fail = page.getByRole('button', {
        name: `No entregado #${String(a.number)}`,
        exact: true,
      });
      expect((await fail.boundingBox())!.height).toBeGreaterThanOrEqual(48);
      await fail.click();
      expect(await overflow()).toBeLessThanOrEqual(0);
    } finally {
      await finishAll(request, [a, b]);
      await Promise.all([a.close(), b.close()]);
    }
  });
});
