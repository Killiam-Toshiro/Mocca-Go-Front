import { expect, test, type Page } from '@playwright/test';
import { Workbook } from 'exceljs';
import { login } from './helpers';

async function download(page: Page, outputPath: string) {
  const [file] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Descargar Excel' }).click(),
  ]);
  const path = outputPath;
  await file.saveAs(path);
  const book = new Workbook();
  await book.xlsx.readFile(path);
  return { name: file.suggestedFilename(), book };
}

const cellOf = (book: Workbook, sheet: string, label: string) => {
  let v: unknown;
  book.getWorksheet(sheet)!.eachRow((r) => {
    if (r.getCell(1).value === label) v = r.getCell(2).value;
  });
  return v;
};

test.describe('exportar a Excel', () => {
  test('métricas: el archivo trae las cinco hojas y coincide con la pantalla', async ({
    page,
  }, info) => {
    // La librería de Excel no se descarga hasta pulsar el botón (CA-07).
    const loaded: string[] = [];
    page.on('response', (r) => {
      if (!r.url().endsWith('.js')) return;
      void r
        .text()
        .then((t) => {
          if (t.includes('xl/worksheets')) loaded.push(r.url());
        })
        .catch(() => undefined);
    });
    await login(page, 'admin', '/admin');
    await page.goto('/admin/metricas');
    await expect(
      page.getByRole('heading', { name: 'Ventas', level: 2 }),
    ).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(loaded).toHaveLength(0);
    await page.getByRole('button', { name: '7 días' }).click();
    await expect(page).toHaveURL(/from=/);
    await expect(page.getByText(/Consultado a las/)).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Descargar Excel' }),
    ).toBeEnabled();
    const ventas = page.getByRole('region', { name: 'Ventas' });
    const shown = Number(
      (
        await ventas
          .getByText('Pedidos', { exact: true })
          .locator('xpath=following-sibling::dd[1]')
          .innerText()
      ).replace(/\D/g, ''),
    );
    const { name, book } = await download(
      page,
      info.outputPath('metricas.xlsx'),
    );
    expect(name).toMatch(
      /^mocca-go-metricas_\d{4}-\d{2}-\d{2}_a_\d{4}-\d{2}-\d{2}\.xlsx$/,
    );
    expect(book.worksheets.map((w) => w.name)).toEqual([
      'Resumen',
      'Ventas por día',
      'Margen por categoría',
      'Entregas por zona',
      'Satisfacción',
    ]);
    await expect.poll(() => loaded.length).toBeGreaterThan(0);
    expect(cellOf(book, 'Resumen', 'Pedidos con pago aprobado')).toBe(shown);
    expect(cellOf(book, 'Resumen', 'Días del periodo')).toBe(7);
    expect(typeof cellOf(book, 'Resumen', 'Ingresos')).toBe('number');
    expect(book.getWorksheet('Ventas por día')!.rowCount).toBe(8);
    await expect(
      page.getByText(/Descargado: mocca-go-metricas_/),
    ).toBeVisible();
  });

  test('métricas con zona: el archivo solo trae esa zona', async ({
    page,
  }, info) => {
    await login(page, 'admin', '/admin');
    await page.goto('/admin/metricas');
    await page.getByLabel('Zona').selectOption({ label: 'Zona 1' });
    await expect(page).toHaveURL(/zoneId=/);
    await expect(
      page.getByRole('button', { name: 'Descargar Excel' }),
    ).toBeEnabled();
    const { name, book } = await download(page, info.outputPath('zona.xlsx'));
    expect(name).toMatch(/_zona-1\.xlsx$/);
    expect(cellOf(book, 'Resumen', 'Zona')).toBe('Zona 1');
    expect(book.getWorksheet('Entregas por zona')!.rowCount).toBe(2);
  });

  test('encuestas: trae todas las respuestas del filtro, no solo la página', async ({
    page,
  }, info) => {
    await login(page, 'admin', '/admin');
    await page.goto('/admin/encuestas?rating=5');
    const list = page.getByRole('list', { name: 'Respuestas' });
    await expect(list.getByRole('listitem').first()).toBeVisible();
    const text = await page
      .getByText(/respuestas?$/)
      .first()
      .innerText();
    const total = Number(text.replace(/\D/g, ''));
    expect(total).toBeGreaterThan(20);
    const { name, book } = await download(
      page,
      info.outputPath('encuestas.xlsx'),
    );
    expect(name).toMatch(/^mocca-go-encuestas_\d{4}-\d{2}-\d{2}\.xlsx$/);
    const sheet = book.getWorksheet('Encuestas')!;
    expect(sheet.rowCount).toBe(1 + total);
    sheet.eachRow((r, i) => i > 1 && expect(r.getCell(5).value).toBe(5));
    expect(book.getWorksheet('Filtros')!.getCell('B2').value).toBe('5');
    // El comentario con HTML del mock se guarda como texto.
    let html = false;
    sheet.eachRow((r) => {
      if (String(r.getCell(6).value ?? '').includes('<b>Excelente</b>'))
        html = true;
    });
    expect(html).toBe(true);
  });

  test('encuestas sin respuestas con ese filtro: no se ofrece descargar', async ({
    page,
  }) => {
    await login(page, 'admin', '/admin');
    await page.goto('/admin/encuestas?from=2020-01-01&to=2020-01-02');
    await expect(
      page.getByText('No hay respuestas con estos filtros.'),
    ).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Descargar Excel' }),
    ).toHaveCount(0);
  });
});
