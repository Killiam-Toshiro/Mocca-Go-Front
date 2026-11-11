import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '../../../tests/utils/render';
import {
  customerFixture,
  fakeUsersBack,
  staffFixtures,
  userFixture,
} from '../../../tests/utils/users';
import { UsersView } from './users-view';

vi.mock('@/components/providers/session-provider', () => ({
  useSession: () => ({
    user: { id: 'u-admin', username: 'admin', role: 'admin' },
    expiresAt: null,
  }),
}));

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

async function openEdit(name: string, label = 'Editar usuario') {
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: `${label} ${name}` }));
  return user;
}

describe('UsersView — lista', () => {
  it('lista el personal con rol en texto, «Tú» en la propia fila y sin acciones sobre ella', async () => {
    fakeUsersBack([...staffFixtures(), customerFixture()]);
    renderWithQuery(<UsersView />);
    expect(await screen.findByText('3 resultados')).toBeInTheDocument();
    const own = rowOf('admin');
    expect(within(own).getByText('Tú')).toBeInTheDocument();
    expect(within(own).getByText('Administrador')).toBeInTheDocument();
    expect(
      within(own).getByText(
        'No puedes modificar tu propio usuario desde aquí.',
      ),
    ).toBeInTheDocument();
    expect(within(own).queryByRole('button')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Editar usuario operador' }),
    ).toBeInTheDocument();
    // «Personal» no incluye clientes.
    expect(screen.queryByText('ana.perez@u.icesi')).toBeNull();
  });

  it('pide al servidor el filtro «Personal» y limit 20', async () => {
    const back = fakeUsersBack();
    renderWithQuery(<UsersView />);
    await screen.findByText('3 resultados');
    expect(back.lists()[0]?.url).toBe(
      '/api/users?page=1&limit=20&role=admin%2Coperador%2Crepartidor',
    );
  });

  it('filtrar por rol envía role y vuelve a la página 1; «Clientes» muestra el correo', async () => {
    const back = fakeUsersBack([...staffFixtures(), customerFixture()]);
    renderWithQuery(<UsersView />);
    await screen.findByText('3 resultados');
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Rol'), 'cliente');
    expect(await screen.findByText('1 resultado')).toBeInTheDocument();
    expect(back.lists().at(-1)?.url).toContain('role=cliente');
    expect(screen.getByText('ana.perez@u.icesi')).toBeInTheDocument();
    expect(screen.getByText('Cliente')).toBeInTheDocument();
  });

  it('la búsqueda espera a que dejes de escribir y se envía al servidor', async () => {
    const back = fakeUsersBack();
    renderWithQuery(<UsersView />);
    await screen.findByText('3 resultados');
    const before = back.lists().length;
    const user = userEvent.setup();
    await user.type(screen.getByLabelText('Buscar usuario'), 'carlos');
    expect(back.lists()).toHaveLength(before);
    expect(await screen.findByText('1 resultado')).toBeInTheDocument();
    expect(back.lists().at(-1)?.url).toContain('search=carlos');
    expect(back.lists()).toHaveLength(before + 1);
    expect(
      screen.getByText('La búsqueda distingue tildes.'),
    ).toBeInTheDocument();
  });

  it('sin coincidencias muestra un mensaje', async () => {
    fakeUsersBack();
    renderWithQuery(<UsersView />);
    await screen.findByText('3 resultados');
    await userEvent
      .setup()
      .type(screen.getByLabelText('Buscar usuario'), 'zzz');
    expect(
      await screen.findByText('No hay usuarios que coincidan con la búsqueda.'),
    ).toBeInTheDocument();
    expect(screen.getByText('0 resultados')).toBeInTheDocument();
  });

  it('pagina de a 20 con el paginador y pide la página siguiente', async () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      userFixture({
        id: `u-${i}`,
        username: `usuario${String(i).padStart(2, '0')}`,
      }),
    );
    const back = fakeUsersBack(many);
    renderWithQuery(<UsersView />);
    expect(await screen.findByText('25 resultados')).toBeInTheDocument();
    expect(screen.getAllByRole('listitem').length).toBeGreaterThanOrEqual(20);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: /Siguiente/ }));
    await waitFor(() => expect(back.lists().at(-1)?.url).toContain('page=2'));
    expect(await screen.findByText(/Página 2 de 2/)).toBeInTheDocument();
  });

  it('esqueleto al cargar y error con «Reintentar»', async () => {
    const back = fakeUsersBack();
    back.state.getFails = true;
    renderWithQuery(<UsersView />);
    expect(screen.getByLabelText('Cargando usuarios')).toBeInTheDocument();
    const retry = await screen.findByRole(
      'button',
      { name: 'Reintentar' },
      { timeout: 4000 },
    );
    back.state.getFails = false;
    await userEvent.setup().click(retry);
    expect(await screen.findByText('3 resultados')).toBeInTheDocument();
  });
});

describe('UsersView — crear', () => {
  it('abre el panel con la clave genérica; crea con un solo POST y avisa', async () => {
    const back = fakeUsersBack();
    renderWithQuery(<UsersView />);
    await screen.findByText('3 resultados');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }));
    expect(screen.getByLabelText('Contraseña inicial')).toHaveValue(
      'clave-generica',
    );
    await user.type(screen.getByLabelText('Usuario'), 'nuevo.op');
    await user.click(
      within(panel()).getByRole('button', { name: 'Crear usuario' }),
    );
    await waitFor(() => expect(back.posts()).toHaveLength(1));
    expect(back.posts()[0]?.body).toEqual({
      username: 'nuevo.op',
      password: 'clave-generica',
      role: 'operador',
    });
    expect(
      await screen.findByText(
        /Usuario nuevo\.op creado\. Pídele que cambie la contraseña en «Mi cuenta»/,
      ),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('un repartidor exige nombre y celular y no envía nada si faltan', async () => {
    const back = fakeUsersBack();
    renderWithQuery(<UsersView />);
    await screen.findByText('3 resultados');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }));
    await user.type(screen.getByLabelText('Usuario'), 'rep.nuevo');
    await user.selectOptions(
      within(panel()).getByLabelText('Rol'),
      'repartidor',
    );
    await user.click(
      within(panel()).getByRole('button', { name: 'Crear usuario' }),
    );
    expect(
      await screen.findByText('Un repartidor necesita su nombre.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Un repartidor necesita su celular.'),
    ).toBeInTheDocument();
    expect(back.posts()).toHaveLength(0);
  });

  it('409 de usuario repetido se muestra bajo el campo Usuario', async () => {
    fakeUsersBack(staffFixtures(), {
      post: { status: 409, message: 'El username ya existe.' },
    });
    renderWithQuery(<UsersView />);
    await screen.findByText('3 resultados');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }));
    await user.type(screen.getByLabelText('Usuario'), 'admin');
    await user.click(
      within(panel()).getByRole('button', { name: 'Crear usuario' }),
    );
    expect(
      await screen.findByText('El username ya existe.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Usuario')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  });

  it('tras un corte de red sin crearse conserva lo escrito y ofrece «Reintentar»', async () => {
    const back = fakeUsersBack(staffFixtures(), { post: 'network' });
    renderWithQuery(<UsersView />);
    await screen.findByText('3 resultados');
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Crear usuario' }));
    await user.type(screen.getByLabelText('Usuario'), 'nuevo.op');
    await user.click(
      within(panel()).getByRole('button', { name: 'Crear usuario' }),
    );
    expect(
      await screen.findByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Usuario')).toHaveValue('nuevo.op');
    expect(back.posts()).toHaveLength(1);
  });
});

describe('UsersView — editar, contraseña, rol y eliminar', () => {
  it('editar envía solo lo que cambió y queda deshabilitado sin cambios', async () => {
    const back = fakeUsersBack();
    renderWithQuery(<UsersView />);
    await screen.findByText('3 resultados');
    const user = await openEdit('operador');
    const save = screen.getByRole('button', { name: 'Guardar cambios' });
    expect(save).toBeDisabled();
    await user.type(screen.getByLabelText('Nombre completo'), 'Olga Operaria');
    expect(save).toBeEnabled();
    await user.click(save);
    await waitFor(() => expect(back.patches()).toHaveLength(1));
    expect(back.patches()[0]?.body).toEqual({ fullName: 'Olga Operaria' });
    expect(
      await screen.findByText('Guardamos los cambios.'),
    ).toBeInTheDocument();
  });

  it('un cliente se edita sin usuario ni correo editables y no ofrece rol ni eliminar', async () => {
    const back = fakeUsersBack([...staffFixtures(), customerFixture()]);
    renderWithQuery(<UsersView />);
    await screen.findByText('3 resultados');
    const user = userEvent.setup();
    await user.selectOptions(screen.getByLabelText('Rol'), 'cliente');
    await screen.findByText('ana.perez@u.icesi');
    await user.click(
      screen.getByRole('button', { name: 'Editar cliente ana.perez@u.icesi' }),
    );
    expect(within(panel()).queryByLabelText('Usuario')).toBeNull();
    expect(
      within(panel()).getByText(
        'El correo y el usuario de un cliente no se editan.',
      ),
    ).toBeInTheDocument();
    expect(
      within(panel()).queryByRole('button', { name: 'Cambiar rol' }),
    ).toBeNull();
    expect(
      within(panel()).queryByRole('button', { name: 'Eliminar usuario' }),
    ).toBeNull();
    const name = screen.getByLabelText('Nombre completo');
    await user.clear(name);
    await user.type(name, 'Ana M.');
    await user.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await waitFor(() =>
      expect(back.patches()[0]?.body).toEqual({ fullName: 'Ana M.' }),
    );
  });

  it('restablecer: el campo empieza vacío, «Usar clave genérica» lo rellena y se vacía al terminar', async () => {
    const back = fakeUsersBack();
    renderWithQuery(<UsersView />);
    await screen.findByText('3 resultados');
    const user = await openEdit('operador');
    const field = screen.getByLabelText('Nueva contraseña');
    expect(field).toHaveValue('');
    expect(
      screen.getByText(
        'Cerrará las sesiones de este usuario y reiniciará su bloqueo.',
      ),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Usar clave genérica' }),
    );
    expect(field).toHaveValue('clave-generica');
    await user.click(
      screen.getByRole('button', { name: 'Restablecer contraseña' }),
    );
    await waitFor(() => expect(back.patches()).toHaveLength(1));
    expect(back.patches()[0]?.body).toEqual({ password: 'clave-generica' });
    expect(
      await screen.findByText(/Restablecimos la contraseña de operador/),
    ).toBeInTheDocument();
    expect(field).toHaveValue('');
  });

  it('cambiar rol envía PATCH /role, avisa del cierre de sesión y cierra el panel', async () => {
    const back = fakeUsersBack();
    renderWithQuery(<UsersView />);
    await screen.findByText('3 resultados');
    const user = await openEdit('operador');
    expect(
      screen.getByText(
        'Se cerrará su sesión y deberá iniciar sesión de nuevo.',
      ),
    ).toBeInTheDocument();
    const change = screen.getByRole('button', { name: 'Cambiar rol' });
    expect(change).toBeDisabled();
    await user.selectOptions(screen.getByLabelText('Nuevo rol'), 'admin');
    await user.click(change);
    await waitFor(() => expect(back.roles()).toHaveLength(1));
    expect(back.roles()[0]?.body).toEqual({ role: 'admin' });
    expect(
      await screen.findByText(/ahora es administrador\. Se cerró su sesión/),
    ).toBeInTheDocument();
  });

  it('a repartidor sin datos pide nombre y celular y los guarda antes del cambio', async () => {
    const back = fakeUsersBack();
    renderWithQuery(<UsersView />);
    await screen.findByText('3 resultados');
    const user = await openEdit('operador');
    await user.selectOptions(screen.getByLabelText('Nuevo rol'), 'repartidor');
    expect(
      screen.getByText('Un repartidor necesita nombre y celular guardados.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cambiar rol' }));
    expect(
      await screen.findByText('Un repartidor necesita su nombre.'),
    ).toBeInTheDocument();
    expect(back.roles()).toHaveLength(0);
    const form = screen.getByRole('form', { name: 'Cambiar rol' });
    await user.type(
      within(form).getByLabelText('Nombre completo'),
      'Rep Nuevo',
    );
    await user.type(within(form).getByLabelText('Celular'), '311 222 3344');
    await user.click(screen.getByRole('button', { name: 'Cambiar rol' }));
    await waitFor(() => expect(back.roles()).toHaveLength(1));
    expect(back.patches()[0]?.body).toEqual({
      fullName: 'Rep Nuevo',
      phone: '311 222 3344',
    });
  });

  it('un 409 del cambio de rol se explica con el texto del back y «Entendido»', async () => {
    fakeUsersBack(staffFixtures(), {
      role: {
        status: 409,
        message: 'No se puede degradar al último administrador.',
      },
    });
    renderWithQuery(<UsersView />);
    await screen.findByText('3 resultados');
    // El panel de otro admin: se cambia por el filtro de rol en el mock.
    const user = await openEdit('operador');
    await user.selectOptions(screen.getByLabelText('Nuevo rol'), 'admin');
    await user.click(screen.getByRole('button', { name: 'Cambiar rol' }));
    expect(
      await screen.findByText('No se puede degradar al último administrador.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(
      screen.queryByText('No se puede degradar al último administrador.'),
    ).toBeNull();
  });

  it('eliminar pide confirmación, cancelar no envía y confirmar envía un DELETE', async () => {
    const back = fakeUsersBack();
    renderWithQuery(<UsersView />);
    await screen.findByText('3 resultados');
    const user = await openEdit('operador');
    await user.click(screen.getByRole('button', { name: 'Eliminar usuario' }));
    expect(
      screen.getByText('¿Eliminar a operador? No se puede deshacer.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(back.deletes()).toHaveLength(0);
    await user.click(screen.getByRole('button', { name: 'Eliminar usuario' }));
    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
    await waitFor(() => expect(back.deletes()).toHaveLength(1));
    expect(
      await screen.findByText('Eliminamos a operador.'),
    ).toBeInTheDocument();
  });

  it('el 409 de historial se explica con el texto del back y una frase propia', async () => {
    fakeUsersBack(staffFixtures(), {
      del: {
        status: 409,
        message: 'El usuario tiene historial asociado; no se puede eliminar.',
      },
    });
    renderWithQuery(<UsersView />);
    await screen.findByText('3 resultados');
    const user = await openEdit('operador');
    await user.click(screen.getByRole('button', { name: 'Eliminar usuario' }));
    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
    expect(
      await screen.findByText(
        'El usuario tiene historial asociado; no se puede eliminar.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Ya tiene actividad; no se puede quitar.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(
      screen.queryByText('Ya tiene actividad; no se puede quitar.'),
    ).toBeNull();
  });

  it('un 404 cierra el panel y explica que el usuario ya no existe', async () => {
    fakeUsersBack(staffFixtures(), {
      del: { status: 404, message: 'Usuario no encontrado.' },
    });
    renderWithQuery(<UsersView />);
    await screen.findByText('3 resultados');
    const user = await openEdit('operador');
    await user.click(screen.getByRole('button', { name: 'Eliminar usuario' }));
    await user.click(screen.getByRole('button', { name: 'Sí, eliminar' }));
    expect(
      await screen.findByText('Usuario no encontrado.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Actualizamos la lista para que veas el estado actual.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('dialog')).toBeNull();
  });
});
