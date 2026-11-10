import { expect, test, type Page } from '@playwright/test';
import { login } from './helpers';

async function sinDesbordeHorizontal(page: Page): Promise<void> {
  const { scroll, width } = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    width: document.documentElement.clientWidth,
  }));
  expect(scroll).toBeLessThanOrEqual(width);
}

test.describe('diseño adaptable', () => {
  test('portada, login y registro no desbordan horizontalmente', async ({
    page,
  }) => {
    for (const path of ['/', '/login', '/registro']) {
      await page.goto(path);
      await sinDesbordeHorizontal(page);
    }
  });

  test('el panel no desborda y «Salir» siempre es alcanzable', async ({
    page,
  }) => {
    await login(page, 'admin', '/admin');
    await sinDesbordeHorizontal(page);
    await expect(page.getByRole('button', { name: 'Salir' })).toBeVisible();
  });

  test('el menú móvil se abre, muestra las secciones del rol y se cierra', async ({
    page,
    isMobile,
  }) => {
    test.skip(!isMobile && (page.viewportSize()?.width ?? 0) >= 768);
    await login(page, 'operador', '/operador');
    await page.getByRole('button', { name: 'Abrir menú' }).click();
    const nav = page.getByRole('navigation', { name: 'Navegación móvil' });
    await expect(nav).toBeVisible();
    await expect(nav.getByText('Inicio')).toBeVisible();
    await expect(nav.getByText('Usuarios')).toHaveCount(0);
    await page.getByRole('button', { name: 'Cerrar menú' }).first().click();
    await expect(nav).toBeHidden();
  });
});
