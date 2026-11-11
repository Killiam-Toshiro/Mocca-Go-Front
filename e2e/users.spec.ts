import { expect, test, type Page } from '@playwright/test';
import { login, newCustomerSession, PASSWORD, placeOrder } from './helpers';
import {
  adminToken,
  API,
  createStaff,
  GENERIC,
  MOCK,
  openUsers,
  rowOf,
  searchUsers,
  uid,
} from './users-helpers';

const overflow = (page: Page) =>
  page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
const dialog = (page: Page) => page.getByRole('dialog');

/** Abre la sesión de un usuario en otro contexto (otro navegador). */
async function otherSession(
  browser: import('@playwright/test').Browser,
  username: string,
  home: string | RegExp,
  password = PASSWORD,
) {
  const context = await browser.newContext();
  const page = await context.newPage();
  await login(page, username, home, password);
  return { context, page };
}

async function adminOn(page: Page) {
  await login(page, 'admin', '/admin');
  await openUsers(page);
}

test.describe('usuarios: acceso', () => {
  test('visitante al login y otros roles a su panel; el admin ve «Usuarios» y «Mi cuenta» (CA-01)', async ({
    page,
  }) => {
    await page.goto('/admin/usuarios');
    await expect(page).toHaveURL(/\/login/);
    await login(page, 'operador', /\/operador$/);
    await page.goto('/admin/usuarios');
    await expect(page).toHaveURL(/\/operador$/);

    await page.context().clearCookies();
    await login(page, 'admin', '/admin');
    await page.goto('/admin');
    const menu = page.getByRole('button', { name: 'Abrir menú' });
    if (await menu.isVisible()) await menu.click();
    await expect(
      page.getByRole('link', { name: 'Usuarios' }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole('link', { name: 'Mi cuenta' }).first(),
    ).toBeVisible();
  });
});

test.describe('usuarios: lista, búsqueda y filtro', () => {
  test('busca por usuario y por teléfono, filtra por rol y marca «Tú» (CA-02, CA-03)', async ({
    page,
    request,
  }) => {
    const id = uid();
    const digits = String(Math.floor(1_000_000 + Math.random() * 8_999_999));
    const op = await createStaff(request, { username: `e2e.op.${id}` });
    const rep = await createStaff(request, {
      username: `e2e.rep.${id}`,
      role: 'repartidor',
      fullName: 'Rosa Repartos',
      phone: `+57300${digits}`,
    });
    await adminOn(page);

    await searchUsers(page, op.username);
    await expect(page.getByText('1 resultado', { exact: true })).toBeVisible();
    await expect(rowOf(page, op.username).getByText('Operador')).toBeVisible();

    // Un rol que no corresponde no encuentra nada.
    await page.getByLabel('Rol').selectOption('repartidor');
    await expect(page.getByText('0 resultados', { exact: true })).toBeVisible();
    await expect(
      page.getByText('No hay usuarios que coincidan con la búsqueda.'),
    ).toBeVisible();

    // Por teléfono con espacios.
    await page.getByLabel('Rol').selectOption('personal');
    await searchUsers(page, `300 ${digits}`);
    await expect(page.getByText('1 resultado', { exact: true })).toBeVisible();
    await expect(rowOf(page, rep.username)).toContainText('Rosa Repartos');

    // Tu propia fila.
    await searchUsers(page, 'admin');
    const own = rowOf(page, 'Tú');
    await expect(own).toBeVisible();
    await expect(
      own.getByText('No puedes modificar tu propio usuario desde aquí.'),
    ).toBeVisible();
    await expect(own.getByRole('button')).toHaveCount(0);
  });

  test('«Personal» no incluye clientes; «Clientes» sí, con su correo', async ({
    page,
    browser,
  }) => {
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    const { email } = await newCustomerSession(customerPage);
    await adminOn(page);
    await searchUsers(page, email);
    await expect(page.getByText('0 resultados', { exact: true })).toBeVisible();
    await page.getByLabel('Rol').selectOption('cliente');
    await expect(page.getByText('1 resultado', { exact: true })).toBeVisible();
    await expect(
      rowOf(page, email).getByText('Cliente', { exact: true }),
    ).toBeVisible();
    await customerContext.close();
  });

  test('pagina de a 20 en el servidor', async ({ page, request }) => {
    const prefix = `e2e.pag.${uid()}`;
    for (let i = 0; i < 21; i++)
      await createStaff(request, {
        username: `${prefix}.${String(i).padStart(2, '0')}`,
      });
    await adminOn(page);
    await searchUsers(page, prefix);
    await expect(page.getByText('21 resultados')).toBeVisible();
    await expect(page.getByText(/Página 1 de 2/)).toBeVisible();
    await expect(
      page.getByRole('list', { name: 'Usuarios' }).getByRole('listitem'),
    ).toHaveCount(20);
    await page.getByRole('button', { name: /Siguiente/ }).click();
    await expect(page.getByText(/Página 2 de 2/)).toBeVisible();
    await expect(
      page.getByRole('list', { name: 'Usuarios' }).getByRole('listitem'),
    ).toHaveCount(1);
  });
});

test.describe('usuarios: crear', () => {
  test('crea un operador con la clave genérica y entra con ella (CA-04)', async ({
    page,
    browser,
  }) => {
    const username = `e2e.nuevo.${uid()}`;
    await adminOn(page);
    await page.getByRole('button', { name: 'Crear usuario' }).click();
    await expect(page.getByLabel('Contraseña inicial')).toHaveValue(GENERIC);
    await page.getByLabel('Usuario', { exact: true }).fill(username);
    await dialog(page).getByRole('button', { name: 'Crear usuario' }).click();
    await expect(
      page.getByText(
        `Usuario ${username} creado. Pídele que cambie la contraseña en «Mi cuenta».`,
      ),
    ).toBeVisible();
    await expect(dialog(page)).toHaveCount(0);

    const { context, page: staff } = await otherSession(
      browser,
      username,
      /\/operador$/,
      GENERIC,
    );
    await staff.goto('/operador/cuenta');
    await expect(
      staff.getByRole('heading', { name: 'Mi cuenta' }),
    ).toBeVisible();
    await context.close();
  });

  test('un repartidor sin datos no se crea; el usuario repetido sale bajo el campo (CA-04, CA-09)', async ({
    page,
  }) => {
    await adminOn(page);
    await page.getByRole('button', { name: 'Crear usuario' }).click();
    await page.getByLabel('Usuario', { exact: true }).fill(`e2e.rep.${uid()}`);
    await page.getByLabel('Rol').last().selectOption('repartidor');
    await dialog(page).getByRole('button', { name: 'Crear usuario' }).click();
    await expect(
      page.getByText('Un repartidor necesita su nombre.'),
    ).toBeVisible();
    await expect(
      page.getByText('Un repartidor necesita su celular.'),
    ).toBeVisible();

    await page.getByLabel('Usuario', { exact: true }).fill('admin');
    await page.getByLabel(/^Nombre completo/).fill('Nombre Válido');
    await page.getByLabel(/^Celular/).fill('311 222 3344');
    await dialog(page).getByRole('button', { name: 'Crear usuario' }).click();
    await expect(page.getByText('El username ya existe.')).toBeVisible();
    await expect(page.getByLabel('Usuario', { exact: true })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  test('tras un corte de red conserva lo escrito y «Reintentar» crea una sola vez (CA-10)', async ({
    page,
    request,
  }) => {
    const username = `e2e.red.${uid()}`;
    let posts = 0;
    let cut = true;
    await page.route('**/api/users', async (route) => {
      if (route.request().method() !== 'POST') return route.continue();
      posts += 1;
      if (cut) return route.abort();
      return route.continue();
    });
    await adminOn(page);
    await page.getByRole('button', { name: 'Crear usuario' }).click();
    await page.getByLabel('Usuario', { exact: true }).fill(username);
    await dialog(page).getByRole('button', { name: 'Crear usuario' }).click();
    const retry = dialog(page).getByRole('button', { name: 'Reintentar' });
    await expect(retry).toBeVisible();
    await expect(page.getByLabel('Usuario', { exact: true })).toHaveValue(
      username,
    );
    expect(posts).toBe(1);
    cut = false;
    await retry.click();
    await expect(page.getByText(`Usuario ${username} creado.`)).toBeVisible();
    expect(posts).toBe(2);
    const list = await request.get(`${API}/users?search=${username}`, {
      headers: {
        authorization: `Bearer ${await adminToken(request)}`,
      },
    });
    expect(((await list.json()) as { total: number }).total).toBe(1);
  });
});

test.describe('usuarios: editar', () => {
  test('edita nombre y celular, valida el usuario repetido y refleja el cambio en la lista (CA-05)', async ({
    page,
    request,
  }) => {
    const op = await createStaff(request, { username: `e2e.edit.${uid()}` });
    await adminOn(page);
    await searchUsers(page, op.username);
    await page
      .getByRole('button', { name: `Editar usuario ${op.username}` })
      .click();
    const save = dialog(page).getByRole('button', { name: 'Guardar cambios' });
    await expect(save).toBeDisabled();
    await page.getByLabel('Nombre completo').first().fill('Olga Operaria');
    await page.getByLabel('Celular').first().fill('311 222 3344');
    await save.click();
    await expect(page.getByText('Guardamos los cambios.')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(dialog(page)).toHaveCount(0);
    await expect(rowOf(page, op.username)).toContainText('Olga Operaria');
    await expect(rowOf(page, op.username)).toContainText('+573112223344');

    await page
      .getByRole('button', { name: `Editar usuario ${op.username}` })
      .click();
    await page.getByLabel('Usuario', { exact: true }).fill('admin');
    await dialog(page).getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('El username ya existe.')).toBeVisible();
  });

  test('el admin edita a un cliente y el cliente lo ve en «Mi perfil» (CA-12)', async ({
    page,
    browser,
  }) => {
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    const { email } = await newCustomerSession(customerPage);
    await adminOn(page);
    await page.getByLabel('Rol').selectOption('cliente');
    await searchUsers(page, email);
    await page.getByRole('button', { name: `Editar cliente ${email}` }).click();
    await expect(
      dialog(page).getByLabel('Usuario', { exact: true }),
    ).toHaveCount(0);
    await expect(
      dialog(page).getByRole('button', { name: 'Cambiar rol' }),
    ).toHaveCount(0);
    await expect(
      dialog(page).getByRole('button', { name: 'Eliminar usuario' }),
    ).toHaveCount(0);
    await page.getByLabel('Nombre completo').fill('Nombre Editado');
    await page.getByLabel('Celular').first().fill('311 222 3344');
    await dialog(page).getByRole('button', { name: 'Guardar cambios' }).click();
    await expect(page.getByText('Guardamos los cambios.')).toBeVisible();

    await customerPage.goto('/cliente/perfil');
    await expect(customerPage.getByLabel('Nombre completo')).toHaveValue(
      'Nombre Editado',
    );
    await expect(
      customerPage.getByLabel('Celular', { exact: true }),
    ).toHaveValue('+573112223344');
    await customerContext.close();
  });
});

test.describe('usuarios: contraseña y rol (cierran la sesión del usuario)', () => {
  test('restablecer con la clave genérica cierra su sesión y entra con la clave nueva (CA-06)', async ({
    page,
    browser,
    request,
  }) => {
    const op = await createStaff(request, { username: `e2e.reset.${uid()}` });
    const { context, page: staff } = await otherSession(
      browser,
      op.username,
      /\/operador$/,
    );
    await adminOn(page);
    await searchUsers(page, op.username);
    await page
      .getByRole('button', { name: `Editar usuario ${op.username}` })
      .click();
    await expect(page.getByLabel('Nueva contraseña')).toHaveValue('');
    await page.getByRole('button', { name: 'Usar clave genérica' }).click();
    await expect(page.getByLabel('Nueva contraseña')).toHaveValue(GENERIC);
    await page.getByRole('button', { name: 'Restablecer contraseña' }).click();
    await expect(
      page.getByText(/Restablecimos la contraseña de/),
    ).toBeVisible();
    await expect(page.getByLabel('Nueva contraseña')).toHaveValue('');

    await staff.goto('/operador');
    await expect(staff).toHaveURL(/\/login/);
    await login(staff, op.username, /\/operador$/, GENERIC);
    await context.close();
  });

  test('cambiar el rol cierra la sesión del usuario y entra al panel nuevo (CA-07, CA-12)', async ({
    page,
    browser,
    request,
  }) => {
    const op = await createStaff(request, { username: `e2e.rol.${uid()}` });
    const { context, page: staff } = await otherSession(
      browser,
      op.username,
      /\/operador$/,
    );
    await adminOn(page);
    await searchUsers(page, op.username);
    await page
      .getByRole('button', { name: `Editar usuario ${op.username}` })
      .click();
    await expect(
      page.getByText('Se cerrará su sesión y deberá iniciar sesión de nuevo.'),
    ).toBeVisible();
    await page.getByLabel('Nuevo rol').selectOption('admin');
    await page.getByRole('button', { name: 'Cambiar rol' }).click();
    await expect(
      page.getByText(/ahora es administrador\. Se cerró su sesión/),
    ).toBeVisible();

    await staff.goto('/operador');
    await expect(staff).toHaveURL(/\/login/);
    await login(staff, op.username, /\/admin$/);
    await context.close();
  });

  test('a repartidor sin datos pide nombre y celular (CA-07)', async ({
    page,
    request,
  }) => {
    const op = await createStaff(request, { username: `e2e.torep.${uid()}` });
    await adminOn(page);
    await searchUsers(page, op.username);
    await page
      .getByRole('button', { name: `Editar usuario ${op.username}` })
      .click();
    await page.getByLabel('Nuevo rol').selectOption('repartidor');
    await page.getByRole('button', { name: 'Cambiar rol' }).click();
    await expect(
      page.getByText('Un repartidor necesita su nombre.'),
    ).toBeVisible();
    const form = page.getByRole('form', { name: 'Cambiar rol' });
    await form.getByLabel('Nombre completo').fill('Rep Nuevo');
    await form.getByLabel('Celular').fill('311 222 3344');
    await page.getByRole('button', { name: 'Cambiar rol' }).click();
    await expect(page.getByText(/ahora es repartidor/)).toBeVisible();
  });
});

test.describe('usuarios: eliminar', () => {
  test('elimina a alguien sin historial con confirmación (CA-08)', async ({
    page,
    request,
  }) => {
    const op = await createStaff(request, { username: `e2e.del.${uid()}` });
    await adminOn(page);
    await searchUsers(page, op.username);
    await page
      .getByRole('button', { name: `Editar usuario ${op.username}` })
      .click();
    await page.getByRole('button', { name: 'Eliminar usuario' }).click();
    await expect(
      page.getByText(`¿Eliminar a ${op.username}? No se puede deshacer.`),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await page.getByRole('button', { name: 'Eliminar usuario' }).click();
    await page.getByRole('button', { name: 'Sí, eliminar' }).click();
    await expect(page.getByText(`Eliminamos a ${op.username}.`)).toBeVisible();
    await expect(page.getByText('0 resultados', { exact: true })).toBeVisible();
  });

  test('con historial el 409 se explica con el texto del back y «Entendido» (CA-08)', async ({
    page,
  }) => {
    await adminOn(page);
    await searchUsers(page, 'veterano');
    await page.getByRole('button', { name: 'Editar usuario veterano' }).click();
    await page.getByRole('button', { name: 'Eliminar usuario' }).click();
    await page.getByRole('button', { name: 'Sí, eliminar' }).click();
    await expect(
      page.getByText(
        'El usuario tiene historial asociado; no se puede eliminar.',
      ),
    ).toBeVisible();
    await expect(
      page.getByText('Ya tiene actividad; no se puede quitar.'),
    ).toBeVisible();
    await page.getByRole('button', { name: 'Entendido' }).click();
    await expect(
      page.getByText('Ya tiene actividad; no se puede quitar.'),
    ).toHaveCount(0);
  });
});

test.describe('usuarios: el repartidor sin datos sale al completarlos el admin (CA-11)', () => {
  test('perfil incompleto → 409; el admin completa nombre y celular → sale', async ({
    page,
    browser,
    request,
  }) => {
    test.setTimeout(90_000);
    const rep = await createStaff(request, {
      username: `e2e.courier.${uid()}`,
      role: 'repartidor',
    });
    await request.post(`${MOCK}/__mock/dispatch`, {
      data: { courier: rep.id, profile: 'incompleto' },
    });
    const customerContext = await browser.newContext();
    const customerPage = await customerContext.newPage();
    await newCustomerSession(customerPage);
    const order = await placeOrder(customerPage);
    await request.post(`${MOCK}/__mock/orders/${order.id}/status`, {
      data: { status: 'listo' },
    });
    await request.post(`${MOCK}/__mock/dispatch`, {
      data: { courier: rep.id, scope: [order.id] },
    });

    const { context, page: courier } = await otherSession(
      browser,
      rep.username,
      '/repartidor',
    );
    try {
      await courier.goto('/repartidor/cola');
      await courier
        .getByRole('button', { name: 'Salir con la sugerencia' })
        .click();
      await expect(
        courier.getByText(
          'Falta tu nombre o teléfono en el perfil: pídele al administrador que los complete.',
        ),
      ).toBeVisible();

      await adminOn(page);
      await searchUsers(page, rep.username);
      await expect(rowOf(page, rep.username)).toContainText(
        'Sin nombre registrado',
      );
      await page
        .getByRole('button', { name: `Editar usuario ${rep.username}` })
        .click();
      await page.getByLabel('Nombre completo').first().fill('Rita Repartidora');
      await page.getByLabel('Celular').first().fill('311 222 3344');
      await dialog(page)
        .getByRole('button', { name: 'Guardar cambios' })
        .click();
      await expect(page.getByText('Guardamos los cambios.')).toBeVisible();

      await courier
        .getByRole('button', { name: 'Salir con la sugerencia' })
        .click();
      await expect(courier).toHaveURL(/\/repartidor\/rondas$/);
    } finally {
      await request.post(`${MOCK}/__mock/orders/${order.id}/status`, {
        data: { status: 'entregado' },
      });
      await context.close();
      await customerContext.close();
    }
  });
});

test.describe('usuarios: diseño', () => {
  test('sin desborde horizontal y botones de al menos 48 px (CA-14)', async ({
    page,
  }) => {
    await adminOn(page);
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    const create = await page
      .getByRole('button', { name: 'Crear usuario' })
      .boundingBox();
    expect(create!.height).toBeGreaterThanOrEqual(47.5);
    const edit = await page
      .getByRole('button', { name: /^Editar usuario/ })
      .first()
      .boundingBox();
    expect(edit!.height).toBeGreaterThanOrEqual(47.5);
    await page
      .getByRole('button', { name: /^Editar usuario/ })
      .first()
      .click();
    expect(await overflow(page)).toBeLessThanOrEqual(0);
    for (const name of ['Guardar cambios', 'Restablecer contraseña']) {
      const box = await dialog(page)
        .getByRole('button', { name })
        .boundingBox();
      expect(box!.height).toBeGreaterThanOrEqual(47.5);
    }
  });
});
