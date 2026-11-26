import { expect, test, type Page } from '@playwright/test';
import { login } from './helpers';

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);

async function menuLink(page: Page, name: string) {
  const menu = page.getByRole('button', { name: 'Abrir menú' });
  const mobile = await menu.isVisible();
  if (mobile) await menu.click();
  await expect(page.getByRole('link', { name }).first()).toBeVisible();
  if (mobile) {
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
  }
}

async function openMetrics(page: Page) {
  await login(page, 'admin', '/admin');
  await page.goto('/admin/metricas');
  await expect(
    page.getByRole('heading', { name: 'Métricas', level: 1 }),
  ).toBeVisible();
  await expect(
    page.getByRole('heading', { name: 'Ventas', level: 2 }),
  ).toBeVisible();
}

test.describe('métricas y encuestas del admin', () => {
  test('guardas: visitante al login, otros roles a su panel; el admin ve las dos secciones en su menú', async ({
    page,
  }) => {
    for (const path of ['/admin/metricas', '/admin/encuestas']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
    await login(page, 'operador', /\/operador$/);
    await page.goto('/admin/metricas');
    await expect(page).toHaveURL(/\/operador$/);
    await page.goto('/admin/encuestas');
    await expect(page).toHaveURL(/\/operador$/);
    await page.context().clearCookies();
    await login(page, 'admin', '/admin');
    await menuLink(page, 'Métricas');
    await menuLink(page, 'Encuestas');
    await expect(page.getByText('Próximamente')).toHaveCount(0);
  });

  test('el panel muestra las seis secciones con gráficas reales y tablas con los mismos datos', async ({
    page,
  }) => {
    await openMetrics(page);
    for (const name of [
      'Margen',
      'Entregas',
      'Satisfacción',
      'Recompra',
      'Resultado de los pedidos',
    ])
      await expect(page.getByRole('heading', { name, level: 2 })).toBeVisible();
    await expect(page.getByRole('button', { name: '30 días' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    // Gráficas de Recharts (SVG real) dentro de una «imagen» con descripción.
    const sales = page.getByRole('img', { name: /ventas por día/ });
    await expect(sales.locator('svg.recharts-surface')).toBeVisible();
    await expect(
      page
        .getByRole('img', { name: /calificación/ })
        .locator('svg.recharts-surface'),
    ).toBeVisible();
    await expect(
      page
        .getByRole('img', { name: /entregados/ })
        .locator('svg.recharts-surface'),
    ).toBeVisible();
    // La tabla alternativa trae los 30 días.
    await page.getByText('Ver ventas por día como tabla').click();
    await expect(
      page.getByRole('region', { name: 'Ventas' }).getByRole('row'),
    ).toHaveCount(31);
    await expect(page.getByText(/Consultado a las/)).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test('cambiar de periodo y de zona actualiza las cifras y la URL; recargar conserva el filtro', async ({
    page,
  }) => {
    await openMetrics(page);
    const total = async () =>
      page
        .getByRole('region', { name: 'Resultado de los pedidos' })
        .getByText('Entregados', { exact: true })
        .locator('xpath=following-sibling::dd[1]')
        .innerText();
    const before = Number(await total());
    await page.getByRole('button', { name: '7 días' }).click();
    await expect(page).toHaveURL(/from=.*&to=/);
    await expect(page.getByRole('button', { name: '7 días' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect.poll(async () => Number(await total())).toBeLessThan(before);
    const week = Number(await total());
    await page.getByLabel('Zona').selectOption({ label: 'Zona 1' });
    await expect(page).toHaveURL(/zoneId=/);
    await expect.poll(async () => Number(await total())).toBeLessThan(week);
    await page.reload();
    await expect(page.getByLabel('Zona')).toHaveValue(/.+/);
    await expect(page.getByRole('button', { name: '7 días' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('periodo personalizado inválido se explica; uno válido se aplica; sin pedidos dice «Sin datos»', async ({
    page,
  }) => {
    await openMetrics(page);
    await page.getByRole('button', { name: 'Personalizado' }).click();
    await page.getByLabel('Desde').fill('2026-05-02');
    await page.getByLabel('Hasta').fill('2026-05-01');
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await expect(page.locator('#metrics-period-error')).toContainText(
      'posterior',
    );
    await page.getByLabel('Desde').fill('2020-01-01');
    await page.getByLabel('Hasta').fill('2020-01-31');
    await page.getByRole('button', { name: 'Aplicar' }).click();
    await expect(page).toHaveURL(/from=2020-01-01&to=2020-01-31/);
    await expect(
      page.getByText('Sin datos en este periodo').first(),
    ).toBeVisible();
    await expect(page.getByText('0 %', { exact: true })).toHaveCount(0);
    await expect(page.locator('svg.recharts-surface')).toHaveCount(0);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test('encuestas: lista, filtra por calificación, pagina y enlaza con métricas', async ({
    page,
  }) => {
    await login(page, 'admin', '/admin');
    await page.goto('/admin/encuestas');
    await expect(
      page.getByRole('heading', { name: 'Encuestas', level: 1 }),
    ).toBeVisible();
    const list = page.getByRole('list', { name: 'Respuestas' });
    await expect(list.getByRole('listitem')).toHaveCount(20);
    await expect(list.getByText(/\d de 5/).first()).toBeVisible();
    // Comentario con HTML: se ve como texto, no se interpreta.
    await expect(page.locator('b', { hasText: 'Excelente' })).toHaveCount(0);
    await page.getByRole('button', { name: /Siguiente/ }).click();
    await expect(page).toHaveURL(/page=2/);
    await page.getByLabel('Calificación').selectOption('5');
    await expect(page).toHaveURL(/rating=5/);
    await expect(page).not.toHaveURL(/page=2/);
    await expect
      .poll(async () => list.getByText('5 de 5').count())
      .toBeGreaterThan(0);
    await expect(list.getByText(/^[1-4] de 5$/)).toHaveCount(0);
    await page.getByRole('button', { name: 'Quitar filtros' }).click();
    await expect(page).not.toHaveURL(/rating=/);
    await page.getByLabel('Desde').fill('2020-01-01');
    await page.getByLabel('Hasta').fill('2020-01-02');
    await expect(
      page.getByText('No hay respuestas con estos filtros.'),
    ).toBeVisible();
    await page
      .getByRole('link', { name: /métricas del mismo periodo/ })
      .click();
    await expect(page).toHaveURL(
      /\/admin\/metricas\?from=2020-01-01&to=2020-01-02/,
    );
    expect(await overflow(page)).toBeLessThanOrEqual(0);
  });

  test('encuestas en el celular: sin desborde y controles cómodos', async ({
    page,
  }) => {
    await login(page, 'admin', '/admin');
    await page.goto('/admin/encuestas');
    const list = page.getByRole('list', { name: 'Respuestas' });
    await expect(list.getByRole('listitem').first()).toBeVisible();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    const box = await page.getByLabel('Calificación').boundingBox();
    expect(box?.height ?? 0).toBeGreaterThanOrEqual(44);
  });
});
