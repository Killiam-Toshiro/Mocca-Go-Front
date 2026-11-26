import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { POINT_ID } from '../../../tests/mock-api/orders';
import { fakeZonesBack } from '../../../tests/utils/zones';
import { renderWithQuery } from '../../../tests/utils/render';
import { ZonesView } from './zones-view';

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

const zoneCard = (name: string) =>
  screen.getByRole('heading', { level: 2, name }).closest('section')!;
const pointRow = (name: string) =>
  screen.getByRole('heading', { level: 4, name }).closest('li')!;
const panel = () => screen.getByRole('dialog');
const ZONE1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ZONE2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

async function loaded(back = fakeZonesBack()) {
  const view = renderWithQuery(<ZonesView />);
  await screen.findByRole('heading', { level: 2, name: 'Zona 1' });
  return { back, user: userEvent.setup(), ...view };
}

describe('ZonesView — lista', () => {
  it('muestra cada zona con sus puntos: pisos, indicación y estado en texto', async () => {
    await loaded();
    expect(
      within(zoneCard('Zona 1')).getByText('3 puntos'),
    ).toBeInTheDocument();
    const a = pointRow('Edificio A');
    expect(
      within(a).getByText('4 pisos · Se entrega en la plazoleta de auditorios'),
    ).toBeInTheDocument();
    expect(within(a).getByText('Activo')).toBeInTheDocument();
    expect(
      within(pointRow('Plazoleta central')).getByText('Sin pisos'),
    ).toBeInTheDocument();
  });

  it('muestra inactivos y zonas vacías', async () => {
    const back = fakeZonesBack();
    back.store.updateZone(ZONE2, { active: false });
    back.store.updatePoint(POINT_ID.edificioA, { active: false });
    back.store.createZone({ name: 'Vacía' });
    renderWithQuery(<ZonesView />);
    await screen.findByRole('heading', { level: 2, name: 'Vacía' });
    expect(
      within(zoneCard('Zona 2')).getByText('Inactiva'),
    ).toBeInTheDocument();
    expect(
      within(pointRow('Edificio A')).getByText('Inactivo'),
    ).toBeInTheDocument();
    expect(
      within(zoneCard('Vacía')).getByText('Sin puntos todavía'),
    ).toBeInTheDocument();
  });

  it('error con «Reintentar»', async () => {
    const back = fakeZonesBack({ getFails: true });
    renderWithQuery(<ZonesView />);
    await screen.findByRole('button', { name: 'Reintentar' });
    back.state.getFails = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByRole('heading', { level: 2, name: 'Zona 1' });
  });
});

describe('ZonesView — vacío', () => {
  it('sin zonas invita a crear la primera', async () => {
    const back = fakeZonesBack();
    for (const id of [
      POINT_ID.edificioA,
      POINT_ID.plazoleta,
      POINT_ID.biblioteca,
      POINT_ID.cafeteria,
      POINT_ID.canchas,
    ])
      back.store.removePoint(id);
    back.store.removeZone(ZONE1);
    back.store.removeZone(ZONE2);
    renderWithQuery(<ZonesView />);
    expect(
      await screen.findByText('Aún no hay zonas. Crea la primera.'),
    ).toBeInTheDocument();
  });
});

describe('ZonesView — zonas', () => {
  it('crea una zona: valida, envía el nombre, avisa y la lista la muestra', async () => {
    const { back, user } = await loaded();
    await user.click(screen.getByRole('button', { name: 'Crear zona' }));
    await user.click(
      within(panel()).getByRole('button', { name: 'Crear zona' }),
    );
    expect(
      await within(panel()).findByText(
        'El nombre debe tener entre 1 y 60 caracteres.',
      ),
    ).toBeInTheDocument();
    expect(back.posts()).toHaveLength(0);
    await user.type(
      within(panel()).getByLabelText('Nombre de la zona'),
      'Zona 3',
    );
    await user.click(
      within(panel()).getByRole('button', { name: 'Crear zona' }),
    );
    await waitFor(() =>
      expect(back.posts()[0]?.body).toEqual({ name: 'Zona 3' }),
    );
    expect(
      await screen.findByText(/Creamos la zona Zona 3/),
    ).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Zona 3' }),
    ).toBeInTheDocument();
  });

  it('un nombre repetido se explica bajo el campo y el panel sigue abierto', async () => {
    const { user } = await loaded();
    await user.click(screen.getByRole('button', { name: 'Crear zona' }));
    await user.type(
      within(panel()).getByLabelText('Nombre de la zona'),
      'zona 1',
    );
    await user.click(
      within(panel()).getByRole('button', { name: 'Crear zona' }),
    );
    expect(
      await within(panel()).findByText('Ya existe una zona con ese nombre.'),
    ).toBeInTheDocument();
  });

  it('renombra enviando solo el nombre; sin cambios el botón está deshabilitado', async () => {
    const { back, user } = await loaded();
    await user.click(screen.getByRole('button', { name: 'Renombrar Zona 2' }));
    const save = within(panel()).getByRole('button', {
      name: 'Guardar cambios',
    });
    expect(save).toBeDisabled();
    const input = within(panel()).getByLabelText('Nombre de la zona');
    await user.clear(input);
    await user.type(input, 'Norte');
    await user.click(save);
    await waitFor(() =>
      expect(back.patches()[0]).toMatchObject({
        url: `/api/delivery-zones/${ZONE2}`,
        body: { name: 'Norte' },
      }),
    );
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Norte' }),
    ).toBeInTheDocument();
  });

  it('desactivar pide confirmación y avisa cuántos puntos dejan de verse; cancelar no envía', async () => {
    const { back, user } = await loaded();
    await user.click(
      within(zoneCard('Zona 1')).getByRole('button', {
        name: 'Desactivar la zona Zona 1',
      }),
    );
    const box = within(zoneCard('Zona 1')).getByRole('group', {
      name: /Confirmar desactivar la zona Zona 1/,
    });
    expect(
      within(box).getByText(/Sus 3 puntos activos dejarán de verse/),
    ).toBeInTheDocument();
    await user.click(within(box).getByRole('button', { name: 'Cancelar' }));
    expect(back.patches()).toHaveLength(0);

    await user.click(
      within(zoneCard('Zona 1')).getByRole('button', {
        name: 'Desactivar la zona Zona 1',
      }),
    );
    await user.click(
      within(zoneCard('Zona 1')).getByRole('button', {
        name: 'Sí, desactivar',
      }),
    );
    await waitFor(() =>
      expect(back.patches()[0]).toMatchObject({
        url: `/api/delivery-zones/${ZONE1}`,
        body: { active: false },
      }),
    );
    expect(
      await screen.findByText(/La zona Zona 1 está inactiva/),
    ).toBeInTheDocument();
    expect(
      await within(zoneCard('Zona 1')).findByText('Inactiva'),
    ).toBeInTheDocument();
  });

  it('avisa si desactivar deja a los clientes sin dónde pedir, sin bloquear', async () => {
    const back = fakeZonesBack();
    back.store.updateZone(ZONE2, { active: false });
    const { user } = await loaded(back);
    await user.click(
      within(zoneCard('Zona 1')).getByRole('button', {
        name: 'Desactivar la zona Zona 1',
      }),
    );
    expect(
      within(zoneCard('Zona 1')).getByText(
        'Los clientes no podrán hacer pedidos hasta que actives otro punto.',
      ),
    ).toBeInTheDocument();
    expect(
      within(zoneCard('Zona 1')).getByRole('button', {
        name: 'Sí, desactivar',
      }),
    ).toBeEnabled();
  });

  it('solo se ofrece eliminar una zona sin puntos; con puntos se explica', async () => {
    const back = fakeZonesBack();
    back.store.createZone({ name: 'Vacía' });
    const { user } = await loaded(back);
    expect(
      screen.queryByRole('button', { name: 'Eliminar la zona Zona 1' }),
    ).not.toBeInTheDocument();
    await screen.findByRole('heading', { level: 2, name: 'Vacía' });
    expect(
      within(zoneCard('Zona 1')).getByText(
        'Para eliminar la zona, mueve o elimina antes sus puntos.',
      ),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Eliminar la zona Vacía' }),
    );
    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
    await waitFor(() => expect(back.deletes()).toHaveLength(1));
    expect(
      await screen.findByText('Eliminamos la zona Vacía.'),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { level: 2, name: 'Vacía' }),
      ).not.toBeInTheDocument(),
    );
  });

  it('una zona con rondas muestra el texto del back y ofrece «Desactivar»', async () => {
    const back = fakeZonesBack();
    const created = back.store.createZone({ name: 'Con rondas' }).body as {
      id: string;
    };
    back.usedZones.add(created.id);
    const { user } = await loaded(back);
    await user.click(
      await screen.findByRole('button', {
        name: 'Eliminar la zona Con rondas',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
    const card = zoneCard('Con rondas');
    expect(
      await within(card).findByText(
        'La zona tiene rondas de despacho; desactívala en vez de eliminarla.',
      ),
    ).toBeInTheDocument();
    await user.click(within(card).getByRole('button', { name: 'Desactivar' }));
    expect(
      within(card).getByRole('button', { name: 'Sí, desactivar' }),
    ).toBeInTheDocument();
  });
});

describe('ZonesView — puntos', () => {
  it('agrega un punto con indicación y pisos: cuerpo exacto', async () => {
    const { back, user } = await loaded();
    await user.click(
      screen.getByRole('button', { name: 'Agregar punto a Zona 2' }),
    );
    const form = within(panel());
    expect(form.getByLabelText('Zona')).toHaveValue(ZONE2);
    await user.type(form.getByLabelText('Nombre del punto'), 'Auditorio');
    await user.type(form.getByLabelText(/Indicación/), 'Entrada lateral');
    await user.click(form.getByLabelText('Este lugar tiene pisos'));
    await user.type(form.getByLabelText('Número de pisos'), '3');
    await user.click(form.getByRole('button', { name: 'Agregar punto' }));
    await waitFor(() =>
      expect(back.posts()[0]?.body).toEqual({
        zoneId: ZONE2,
        name: 'Auditorio',
        hint: 'Entrada lateral',
        floors: 3,
      }),
    );
    expect(
      await screen.findByText('Agregamos el punto Auditorio.'),
    ).toBeInTheDocument();
    expect(
      within(
        await screen
          .findByRole('heading', { level: 4, name: 'Auditorio' })
          .then((h) => h.closest('li')!),
      ).getByText('3 pisos · Entrada lateral'),
    ).toBeInTheDocument();
  });

  it('valida los pisos y un nombre repetido se explica bajo el campo', async () => {
    const { back, user } = await loaded();
    await user.click(
      screen.getByRole('button', { name: 'Agregar punto a Zona 2' }),
    );
    const form = within(panel());
    await user.type(form.getByLabelText('Nombre del punto'), 'Edificio A');
    await user.click(form.getByLabelText('Este lugar tiene pisos'));
    await user.type(form.getByLabelText('Número de pisos'), '31');
    await user.click(form.getByRole('button', { name: 'Agregar punto' }));
    expect(
      await form.findByText('Los pisos son un número entero de 1 a 30.'),
    ).toBeInTheDocument();
    expect(back.posts()).toHaveLength(0);
    await user.clear(form.getByLabelText('Número de pisos'));
    await user.type(form.getByLabelText('Número de pisos'), '2');
    await user.click(form.getByRole('button', { name: 'Agregar punto' }));
    expect(
      await form.findByText('Ya existe un punto con ese nombre.'),
    ).toBeInTheDocument();
  });

  it('edita enviando solo lo modificado: indicación vacía y «sin pisos» van como null', async () => {
    const { back, user } = await loaded();
    await user.click(screen.getByRole('button', { name: 'Editar Edificio A' }));
    const form = within(panel());
    expect(
      form.getByRole('button', { name: 'Guardar cambios' }),
    ).toBeDisabled();
    await user.clear(form.getByLabelText(/Indicación/));
    await user.click(form.getByLabelText('Este lugar tiene pisos'));
    await user.click(form.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() =>
      expect(back.patches()[0]).toMatchObject({
        url: `/api/delivery-points/${POINT_ID.edificioA}`,
        body: { hint: null, floors: null },
      }),
    );
    expect(
      within(
        await screen
          .findByRole('heading', { level: 4, name: 'Edificio A' })
          .then((h) => h.closest('li')!),
      ).getByText('Sin pisos'),
    ).toBeInTheDocument();
  });

  it('mueve un punto a otra zona y aparece bajo la nueva', async () => {
    const { back, user } = await loaded();
    await user.click(screen.getByRole('button', { name: 'Editar Biblioteca' }));
    await user.selectOptions(within(panel()).getByLabelText('Zona'), ZONE2);
    await user.click(
      within(panel()).getByRole('button', { name: 'Guardar cambios' }),
    );
    await waitFor(() =>
      expect(back.patches()[0]?.body).toEqual({ zoneId: ZONE2 }),
    );
    await waitFor(() =>
      expect(
        within(zoneCard('Zona 2')).getByRole('heading', {
          level: 4,
          name: 'Biblioteca',
        }),
      ).toBeInTheDocument(),
    );
    expect(
      within(zoneCard('Zona 1')).queryByRole('heading', {
        level: 4,
        name: 'Biblioteca',
      }),
    ).not.toBeInTheDocument();
  });

  it('desactivar un punto pide confirmación', async () => {
    const { back, user } = await loaded();
    await user.click(
      screen.getByRole('button', { name: 'Desactivar Edificio A' }),
    );
    expect(
      within(pointRow('Edificio A')).getByText(
        /Los clientes dejarán de verlo al pedir/,
      ),
    ).toBeInTheDocument();
    await user.click(
      within(pointRow('Edificio A')).getByRole('button', {
        name: 'Sí, desactivar',
      }),
    );
    await waitFor(() =>
      expect(back.patches()[0]).toMatchObject({
        url: `/api/delivery-points/${POINT_ID.edificioA}`,
        body: { active: false },
      }),
    );
    expect(
      await screen.findByText(/Edificio A está inactivo/),
    ).toBeInTheDocument();
  });

  it('eliminar un punto con pedidos muestra el texto del back y ofrece «Desactivar»', async () => {
    const { back, user } = await loaded(
      fakeZonesBack({ usedPoints: [POINT_ID.canchas] }),
    );
    await user.click(screen.getByRole('button', { name: 'Eliminar Canchas' }));
    await user.click(
      within(pointRow('Canchas')).getByRole('button', { name: 'Sí, eliminar' }),
    );
    const row = pointRow('Canchas');
    expect(
      await within(row).findByText(
        'El punto tiene pedidos; desactívalo en vez de eliminarlo.',
      ),
    ).toBeInTheDocument();
    await user.click(within(row).getByRole('button', { name: 'Desactivar' }));
    await user.click(
      within(pointRow('Canchas')).getByRole('button', {
        name: 'Sí, desactivar',
      }),
    );
    await waitFor(() =>
      expect(back.patches()[0]?.body).toEqual({ active: false }),
    );
  });

  it('eliminar un punto libre lo quita de la lista', async () => {
    const { back, user } = await loaded();
    await user.click(
      screen.getByRole('button', { name: 'Eliminar Cafetería' }),
    );
    await user.click(
      within(pointRow('Cafetería')).getByRole('button', {
        name: 'Sí, eliminar',
      }),
    );
    await waitFor(() => expect(back.deletes()).toHaveLength(1));
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { level: 4, name: 'Cafetería' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      await screen.findByText('Eliminamos el punto Cafetería.'),
    ).toBeInTheDocument();
  });

  it('un 404 (otro admin lo eliminó) se explica con «Entendido» y se actualiza la lista', async () => {
    const { back, user } = await loaded();
    back.store.removePoint(POINT_ID.cafeteria);
    await user.click(
      screen.getByRole('button', { name: 'Desactivar Cafetería' }),
    );
    await user.click(
      within(pointRow('Cafetería')).getByRole('button', {
        name: 'Sí, desactivar',
      }),
    );
    expect(await screen.findByText('Punto no encontrado.')).toBeInTheDocument();
    expect(
      screen.getByText('Actualizamos la lista para que veas el estado actual.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Entendido' }));
    await waitFor(() =>
      expect(
        screen.queryByRole('heading', { level: 4, name: 'Cafetería' }),
      ).not.toBeInTheDocument(),
    );
  });
});
