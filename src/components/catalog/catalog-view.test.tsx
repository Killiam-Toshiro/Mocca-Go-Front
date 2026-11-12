import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { fakeCatalogBack } from '../../../tests/utils/catalog';
import { renderWithQuery } from '../../../tests/utils/render';
import { CatalogView } from './catalog-view';

beforeAll(() => {
  // jsdom no implementa el modal de <dialog>.
  HTMLDialogElement.prototype.showModal ??= function showModal(
    this: HTMLDialogElement,
  ) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close ??= function close(
    this: HTMLDialogElement,
  ) {
    this.removeAttribute('open');
  };
});
afterEach(() => vi.unstubAllGlobals());

const rowOf = (name: string) =>
  screen.getByRole('heading', { name: new RegExp(name) }).closest('li')!;
const panel = () => screen.getByRole('dialog');

async function loaded(back = fakeCatalogBack(), total = '23 resultados') {
  const view = renderWithQuery(<CatalogView />);
  await screen.findByText(total);
  return { back, user: userEvent.setup(), ...view };
}

describe('CatalogView — lista', () => {
  it('lista con SKU, categoría, precio, costo y margen, estado en texto y composición del combo', async () => {
    await loaded();
    const espresso = rowOf('Espresso');
    expect(within(espresso).getByText(/CAF-ESPR · Café/)).toBeInTheDocument();
    expect(within(espresso).getByText('$3.000')).toBeInTheDocument();
    expect(
      within(espresso).getByText(/Costo \$1\.050 · 35 % del precio/),
    ).toBeInTheDocument();
    expect(within(espresso).getByText('Disponible')).toBeInTheDocument();
    const combo = rowOf('Combo Clásico');
    expect(within(combo).getByText('Combo')).toBeInTheDocument();
    expect(
      within(combo).getByText(/1 × Capuchino, 1 × Pandebono/),
    ).toBeInTheDocument();
  });

  it('pide al servidor limit 20 y pagina', async () => {
    const { back, user } = await loaded();
    expect(back.lists()[0]?.url).toBe('/api/products?page=1&limit=20');
    await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    await waitFor(() => expect(back.lists().at(-1)?.url).toContain('page=2'));
    expect(await screen.findByText(/Página 2 de 2/)).toBeInTheDocument();
  });

  it('búsqueda (con espera), categoría y estado se envían al servidor y vuelven a la página 1', async () => {
    const { back, user } = await loaded();
    await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    await screen.findByText(/Página 2 de 2/);
    const before = back.lists().length;
    await user.type(screen.getByLabelText('Buscar producto'), 'espresso');
    expect(back.lists()).toHaveLength(before);
    expect(await screen.findByText('1 resultado')).toBeInTheDocument();
    expect(back.lists().at(-1)?.url).toContain('page=1');
    expect(back.lists().at(-1)?.url).toContain('search=espresso');
    await user.clear(screen.getByLabelText('Buscar producto'));
    await user.selectOptions(screen.getByLabelText('Categoría'), 'combo');
    expect(await screen.findByText('3 resultados')).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Estado'), 'inactivos');
    expect(await screen.findByText(/No hay productos/)).toBeInTheDocument();
    expect(back.lists().at(-1)?.url).toContain('category=combo');
    expect(back.lists().at(-1)?.url).toContain('active=false');
  });

  it('esqueleto al cargar y error con «Reintentar»', async () => {
    const back = fakeCatalogBack({ getFails: true });
    renderWithQuery(<CatalogView />);
    expect(screen.getByLabelText('Cargando catálogo')).toBeInTheDocument();
    const retry = await screen.findByRole(
      'button',
      { name: 'Reintentar' },
      { timeout: 4000 },
    );
    back.state.getFails = false;
    await userEvent.setup().click(retry);
    expect(await screen.findByText('23 resultados')).toBeInTheDocument();
  });
});

describe('CatalogView — crear', () => {
  it('crea un producto: un solo POST con el cuerpo exacto, SKU en mayúsculas, y avisa', async () => {
    const { back, user } = await loaded();
    await user.click(screen.getByRole('button', { name: 'Crear producto' }));
    const p = within(panel());
    await user.type(p.getByLabelText('SKU'), 'snk-nuevo');
    await user.type(p.getByLabelText('Nombre'), 'Galleta');
    await user.selectOptions(p.getByLabelText('Categoría'), 'snack');
    await user.type(p.getByLabelText('Precio'), '3000');
    await user.type(p.getByLabelText('Costo'), '1000');
    await user.click(p.getByRole('button', { name: 'Crear producto' }));
    expect(
      await screen.findByText(/Producto Galleta creado/),
    ).toBeInTheDocument();
    expect(back.posts()).toHaveLength(1);
    expect(back.posts()[0]?.body).toEqual({
      sku: 'SNK-NUEVO',
      name: 'Galleta',
      category: 'snack',
      price: 3000,
      cost: 1000,
    });
  });

  it('valida sin enviar nada y muestra el 409 de SKU repetido bajo el campo', async () => {
    const { back, user } = await loaded();
    await user.click(screen.getByRole('button', { name: 'Crear producto' }));
    const p = within(panel());
    await user.click(p.getByRole('button', { name: 'Crear producto' }));
    expect(await p.findByText(/Usa letras mayúsculas/)).toBeInTheDocument();
    expect(p.getByText(/El precio es un número entero/)).toBeInTheDocument();
    expect(back.posts()).toHaveLength(0);
    await user.type(p.getByLabelText('SKU'), 'CAF-ESPR');
    await user.type(p.getByLabelText('Nombre'), 'Otro');
    await user.type(p.getByLabelText('Precio'), '1000');
    await user.type(p.getByLabelText('Costo'), '100');
    await user.click(p.getByRole('button', { name: 'Crear producto' }));
    expect(await p.findByText('El SKU ya existe.')).toBeInTheDocument();
    expect(p.getByLabelText('SKU')).toHaveAttribute('aria-invalid', 'true');
  });

  it('tras un corte de red sin crearse conserva lo escrito y ofrece «Reintentar»', async () => {
    const back = fakeCatalogBack({ post: 'network' });
    const { user } = await loaded(back);
    await user.click(screen.getByRole('button', { name: 'Crear producto' }));
    const p = within(panel());
    await user.type(p.getByLabelText('SKU'), 'NET-1');
    await user.type(p.getByLabelText('Nombre'), 'Red');
    await user.type(p.getByLabelText('Precio'), '1000');
    await user.type(p.getByLabelText('Costo'), '100');
    await user.click(p.getByRole('button', { name: 'Crear producto' }));
    expect(
      await p.findByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument();
    expect(p.getByLabelText('Nombre')).toHaveValue('Red');
    expect(back.posts()).toHaveLength(1);
  });

  it('crea un combo: suma y costo en vivo, sin costo en el cuerpo y con precio por defecto', async () => {
    const { back, user } = await loaded();
    await user.click(screen.getByRole('button', { name: 'Crear producto' }));
    const p = within(panel());
    await user.selectOptions(p.getByLabelText('Tipo'), 'combo');
    expect(p.queryByLabelText('Costo')).toBeNull();
    await user.type(p.getByLabelText('SKU'), 'cmb-nuevo');
    await user.type(p.getByLabelText('Nombre'), 'Combo nuevo');
    await user.click(
      await p.findByRole('button', { name: 'Agregar Espresso' }),
    );
    await user.click(p.getByRole('button', { name: 'Agregar Pandebono' }));
    await user.selectOptions(p.getByLabelText('Cantidad de Pandebono'), '2');
    expect(
      p.getByText(/Suma de precios \$8\.000 · Costo calculado \$2\.800/),
    ).toBeInTheDocument();
    expect(p.getByRole('button', { name: 'Agregar Espresso' })).toBeDisabled();
    await user.click(p.getByRole('button', { name: 'Crear combo' }));
    expect(
      await screen.findByText(/Combo Combo nuevo creado/),
    ).toBeInTheDocument();
    const sent = back.posts()[0]?.body as Record<string, unknown>;
    expect(sent).toEqual({
      sku: 'CMB-NUEVO',
      name: 'Combo nuevo',
      category: 'combo',
      components: [
        { productId: back.idOf('CAF-ESPR'), quantity: 1 },
        { productId: back.idOf('PAN-PAND'), quantity: 2 },
      ],
    });
    expect('cost' in sent).toBe(false);
  });

  it('un combo con menos de 2 componentes no se envía', async () => {
    const { back, user } = await loaded();
    await user.click(screen.getByRole('button', { name: 'Crear producto' }));
    const p = within(panel());
    await user.selectOptions(p.getByLabelText('Tipo'), 'combo');
    await user.type(p.getByLabelText('SKU'), 'CMB-X');
    await user.type(p.getByLabelText('Nombre'), 'X');
    await user.click(
      await p.findByRole('button', { name: 'Agregar Espresso' }),
    );
    await user.click(p.getByRole('button', { name: 'Crear combo' }));
    expect(
      await p.findByText(/entre 2 y 10 productos distintos/, {
        selector: '[role="alert"]',
      }),
    ).toBeInTheDocument();
    expect(back.posts()).toHaveLength(0);
  });

  it('los combos y los inactivos no se ofrecen como componentes', async () => {
    const back = fakeCatalogBack();
    back.store.setActive('CAF-AMER', false);
    const { user } = await loaded(back);
    await user.click(screen.getByRole('button', { name: 'Crear producto' }));
    const p = within(panel());
    await user.selectOptions(p.getByLabelText('Tipo'), 'combo');
    await p.findByRole('button', { name: 'Agregar Espresso' });
    expect(p.queryByRole('button', { name: /Agregar Combo/ })).toBeNull();
    expect(p.queryByRole('button', { name: 'Agregar Americano' })).toBeNull();
  });
});

describe('CatalogView — editar y componer', () => {
  it('editar envía solo lo que cambió, queda deshabilitado sin cambios y vacía la descripción con null', async () => {
    const { back, user } = await loaded();
    await user.click(screen.getByRole('button', { name: 'Editar Espresso' }));
    const p = within(panel());
    expect(p.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled();
    expect(p.getByText('CAF-ESPR')).toBeInTheDocument();
    await user.clear(p.getByLabelText('Precio'));
    await user.type(p.getByLabelText('Precio'), '3300');
    await user.clear(p.getByLabelText('Descripción'));
    await user.click(p.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() => expect(back.patches()).toHaveLength(1));
    expect(back.patches()[0]?.body).toEqual({ price: 3300, description: null });
  });

  it('un combo no ofrece costo ni categoría y muestra el costo calculado', async () => {
    const { user } = await loaded();
    await user.click(
      screen.getByRole('button', { name: 'Editar Combo Clásico' }),
    );
    const p = within(panel());
    expect(p.queryByLabelText('Costo')).toBeNull();
    expect(p.queryByLabelText('Categoría')).toBeNull();
    expect(p.getAllByText(/Costo calculado \$2\.450/).length).toBeGreaterThan(
      0,
    );
  });

  it('recomponer envía PUT, advierte que el precio no cambia y el precio sigue igual', async () => {
    const { back, user } = await loaded();
    await user.click(
      screen.getByRole('button', { name: 'Editar Combo Clásico' }),
    );
    const p = within(panel());
    expect(
      await p.findByText(
        /El precio del combo no cambia al cambiar sus componentes/,
      ),
    ).toBeInTheDocument();
    await user.click(
      await p.findByRole('button', { name: 'Quitar Pandebono' }),
    );
    await user.click(p.getByRole('button', { name: 'Agregar Brownie' }));
    await user.click(p.getByRole('button', { name: 'Guardar composición' }));
    await waitFor(() => expect(back.puts()).toHaveLength(1));
    expect(back.puts()[0]?.body).toEqual({
      components: [
        { productId: back.idOf('CAF-CAPU'), quantity: 1 },
        { productId: back.idOf('PAS-BROW'), quantity: 1 },
      ],
    });
    expect(await p.findByText(/Precio actual \$6\.500/)).toBeInTheDocument();
  });

  it('si el back rechaza la composición se muestra su texto y se conserva lo elegido', async () => {
    const back = fakeCatalogBack({
      put: { status: 400, message: 'El componente PAN-PAND está inactivo.' },
    });
    const { user } = await loaded(back);
    await user.click(
      screen.getByRole('button', { name: 'Editar Combo Clásico' }),
    );
    const p = within(panel());
    await user.click(
      await p.findByRole('button', { name: 'Quitar Pandebono' }),
    );
    await user.click(p.getByRole('button', { name: 'Agregar Brownie' }));
    await user.click(p.getByRole('button', { name: 'Guardar composición' }));
    expect(
      (await p.findAllByText('El componente PAN-PAND está inactivo.')).length,
    ).toBeGreaterThan(0);
    expect(
      p.getByRole('button', { name: 'Quitar Brownie' }),
    ).toBeInTheDocument();
  });
});

describe('CatalogView — estado, agotado y eliminar', () => {
  it('desactivar pide confirmación; cancelar no envía; confirmar avisa de los combos afectados y envía', async () => {
    const { back, user } = await loaded();
    const row = within(rowOf('Capuchino'));
    await user.click(row.getByRole('button', { name: 'Desactivar Capuchino' }));
    expect(await row.findByText(/Combo Clásico/)).toBeInTheDocument();
    expect(row.getByText(/dejarán de estar disponibles/)).toBeInTheDocument();
    await user.click(row.getByRole('button', { name: 'Cancelar' }));
    expect(back.statuses()).toHaveLength(0);
    await user.click(row.getByRole('button', { name: 'Desactivar Capuchino' }));
    await user.click(row.getByRole('button', { name: 'Sí, desactivar' }));
    expect(
      await screen.findByText('Capuchino está inactivo.'),
    ).toBeInTheDocument();
    expect(back.statuses()).toHaveLength(1);
    expect(back.statuses()[0]?.body).toEqual({ active: false });
    expect(
      await within(rowOf('Capuchino')).findByText('Inactivo'),
    ).toBeInTheDocument();
  });

  it('activar también pide confirmación', async () => {
    const back = fakeCatalogBack();
    back.store.setActive('CAF-ESPR', false);
    const { user } = await loaded(back);
    const row = within(rowOf('Espresso'));
    await user.click(row.getByRole('button', { name: 'Activar Espresso' }));
    expect(back.statuses()).toHaveLength(0);
    await user.click(row.getByRole('button', { name: 'Sí, activar' }));
    expect(
      await screen.findByText('Espresso está activo.'),
    ).toBeInTheDocument();
    expect(back.statuses()[0]?.body).toEqual({ active: true });
  });

  it('«Marcar agotado» envía sin confirmación y avisa', async () => {
    const { back, user } = await loaded();
    await user.click(
      screen.getByRole('button', { name: 'Marcar agotado Espresso' }),
    );
    expect(
      await screen.findByText('Espresso quedó marcado como agotado.'),
    ).toBeInTheDocument();
    expect(back.soldOuts()[0]?.body).toEqual({ soldOut: true });
  });

  it('eliminar pide confirmación, cancelar no envía y un producto libre se elimina', async () => {
    const back = fakeCatalogBack();
    back.store.createProduct({
      sku: 'DEL-1',
      name: 'Borrable',
      category: 'snack',
      price: 1000,
      cost: 100,
    });
    const { user } = await loaded(back, '24 resultados');
    await user.click(screen.getByRole('button', { name: 'Editar Borrable' }));
    const p = within(panel());
    await user.click(p.getByRole('button', { name: 'Eliminar producto' }));
    await user.click(p.getByRole('button', { name: 'Cancelar' }));
    expect(back.deletes()).toHaveLength(0);
    await user.click(p.getByRole('button', { name: 'Eliminar producto' }));
    expect(
      p.getByText(/¿Eliminar Borrable\? No se puede deshacer\./),
    ).toBeInTheDocument();
    await user.click(p.getByRole('button', { name: 'Sí, eliminar' }));
    expect(await screen.findByText('Eliminamos Borrable.')).toBeInTheDocument();
    expect(back.deletes()).toHaveLength(1);
    expect(await screen.findByText('23 resultados')).toBeInTheDocument();
  });

  it('el 409 de componente se explica con el texto del back y ofrece desactivar con confirmación', async () => {
    const { back, user } = await loaded();
    await user.click(screen.getByRole('button', { name: 'Editar Pandebono' }));
    const p = within(panel());
    await user.click(p.getByRole('button', { name: 'Eliminar producto' }));
    await user.click(p.getByRole('button', { name: 'Sí, eliminar' }));
    expect(
      await p.findByText('El producto es componente de un combo.'),
    ).toBeInTheDocument();
    await user.click(p.getByRole('button', { name: 'Desactivar Pandebono' }));
    expect(back.statuses()).toHaveLength(0);
    await user.click(p.getByRole('button', { name: 'Sí, desactivar' }));
    expect(
      await screen.findByText('Pandebono está inactivo.'),
    ).toBeInTheDocument();
    expect(back.statuses()).toHaveLength(1);
  });

  it('el 409 por movimientos usa el texto del back', async () => {
    const back = fakeCatalogBack();
    back.store.createProduct({
      sku: 'MOV-1',
      name: 'Con historial',
      category: 'snack',
      price: 1000,
      cost: 100,
    });
    back.store.createMovement(
      { id: 'u', username: 'op' },
      {
        productId: back.items.find((i) => i.sku === 'MOV-1')!.id,
        type: 'IN',
        quantity: 2,
        reason: 'x',
      },
    );
    const { user } = await loaded(back, '24 resultados');
    await user.click(
      screen.getByRole('button', { name: 'Editar Con historial' }),
    );
    const p = within(panel());
    await user.click(p.getByRole('button', { name: 'Eliminar producto' }));
    await user.click(p.getByRole('button', { name: 'Sí, eliminar' }));
    expect(
      await p.findByText(/El producto tiene movimientos/),
    ).toBeInTheDocument();
  });

  it('un 404 al desactivar cierra el panel y explica que el producto ya no existe', async () => {
    const back = fakeCatalogBack({
      status: { status: 404, message: 'Producto no encontrado.' },
    });
    const { user } = await loaded(back);
    const row = within(rowOf('Espresso'));
    await user.click(row.getByRole('button', { name: 'Desactivar Espresso' }));
    await user.click(row.getByRole('button', { name: 'Sí, desactivar' }));
    expect(
      await screen.findByText('Producto no encontrado.'),
    ).toBeInTheDocument();
    expect(screen.getByText(/Actualizamos el catálogo/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByText('Producto no encontrado.')).toBeNull();
  });
});
