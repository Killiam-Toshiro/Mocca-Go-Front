import { expect, test } from '@playwright/test';

test('la portada carga y se ve el nombre de la aplicación', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Mocca Go/);
  await expect(
    page.getByText('Café y snacks a domicilio dentro del campus de Icesi.'),
  ).toBeVisible();
});
