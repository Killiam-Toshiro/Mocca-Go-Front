import { expect, test } from '@playwright/test';

test.describe('menú público', () => {
  test('muestra el menú por categorías sin iniciar sesión', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Mocca Go/);
    await expect(
      page.getByRole('heading', { level: 1, name: 'Menú' }),
    ).toBeVisible();
    for (const name of [
      'Combos',
      'Cafés',
      'Panadería',
      'Pastelería',
      'Snacks',
    ]) {
      await expect(page.getByRole('heading', { level: 2, name })).toBeVisible();
    }
    await expect(page.getByText('$4.500').first()).toBeVisible();
    // Los agotados se ven pero no se pueden agregar.
    await expect(page.getByText('Agotado').first()).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Agregar Tres leches al carrito' }),
    ).toHaveCount(0);
  });

  test('el filtro por categoría deja solo esa sección', async ({ page }) => {
    await page.goto('/');
    await page
      .getByRole('navigation', { name: 'Categorías' })
      .getByRole('button', { name: 'Snacks' })
      .click();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Snacks' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', { level: 2, name: 'Cafés' }),
    ).toHaveCount(0);
  });

  test('el detalle de un combo lista lo que incluye y se cierra con Escape', async ({
    page,
  }) => {
    await page.goto('/');
    await page
      .getByRole('button', { name: /Combo Clásico/ })
      .first()
      .click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText('Incluye')).toBeVisible();
    await expect(dialog.getByText('1 × Capuchino')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('no desborda horizontalmente', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Menú' }),
    ).toBeVisible();
    const { scroll, width } = await page.evaluate(() => ({
      scroll: document.documentElement.scrollWidth,
      width: document.documentElement.clientWidth,
    }));
    expect(scroll).toBeLessThanOrEqual(width);
  });
});
