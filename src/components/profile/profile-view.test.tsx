import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeProfileBack, profileFixture } from '../../../tests/utils/profile';
import { renderWithQuery } from '../../../tests/utils/render';
import { ProfileView } from './profile-view';

afterEach(() => vi.unstubAllGlobals());

const save = () =>
  screen.getByRole('button', { name: /Guardar cambios|Guardando/ });
const nameField = () => screen.getByLabelText('Nombre completo');
const phoneField = () => screen.getByLabelText('Celular');

describe('ProfileView — mis datos', () => {
  it('muestra correo (solo lectura, con su nota), nombre, celular y fecha de alta', async () => {
    fakeProfileBack();
    renderWithQuery(<ProfileView />);
    expect(
      await screen.findByRole('heading', { name: 'Mis datos' }),
    ).toBeInTheDocument();
    expect(screen.getByText('ana@example.com')).toBeInTheDocument();
    expect(
      screen.getByText('El correo no se puede cambiar.'),
    ).toBeInTheDocument();
    expect(screen.getByText('3 de noviembre de 2026')).toBeInTheDocument();
    expect(nameField()).toHaveValue('Ana Pérez');
    expect(phoneField()).toHaveValue('+573001234567');
    expect(screen.queryByLabelText('Correo', { selector: 'input' })).toBeNull();
  });

  it('muestra un esqueleto al cargar', () => {
    fakeProfileBack();
    renderWithQuery(<ProfileView />);
    expect(screen.getByLabelText('Cargando tu perfil')).toHaveAttribute(
      'aria-busy',
      'true',
    );
  });

  it('si falla la consulta ofrece «Reintentar» y no muestra los formularios vacíos', async () => {
    const back = fakeProfileBack(profileFixture(), { getFails: true });
    renderWithQuery(<ProfileView />);
    // La consulta se reintenta una vez sola antes de mostrar el error.
    const retry = await screen.findByRole(
      'button',
      { name: 'Reintentar' },
      { timeout: 4000 },
    );
    expect(screen.queryByLabelText('Nombre completo')).toBeNull();
    back.state.getFails = false;
    await userEvent.click(retry);
    expect(await screen.findByLabelText('Nombre completo')).toHaveValue(
      'Ana Pérez',
    );
  });
});

describe('ProfileView — editar', () => {
  it('«Guardar cambios» se habilita solo si algo cambió', async () => {
    fakeProfileBack();
    renderWithQuery(<ProfileView />);
    await screen.findByLabelText('Nombre completo');
    expect(save()).toBeDisabled();
    await userEvent.type(nameField(), ' M.');
    expect(save()).toBeEnabled();
    await userEvent.type(nameField(), '{Backspace}{Backspace}{Backspace}');
    expect(save()).toBeDisabled();
  });

  it('envía solo el campo modificado, muestra el valor E.164, anuncia y enfoca el aviso', async () => {
    const back = fakeProfileBack();
    const { client } = renderWithQuery(<ProfileView />);
    await screen.findByLabelText('Celular');
    await userEvent.clear(phoneField());
    await userEvent.type(phoneField(), '300 765 4322');
    await userEvent.click(save());
    const status = await screen.findByText('Guardamos tus cambios.');
    expect(back.patches()).toHaveLength(1);
    expect(back.patches()[0]?.body).toEqual({ phone: '300 765 4322' });
    expect(phoneField()).toHaveValue('+573007654322');
    await waitFor(() => expect(status).toHaveFocus());
    expect(save()).toBeDisabled();
    expect(
      client.getQueryData<{ phone: string }>(['customers', 'me'])?.phone,
    ).toBe('+573007654322');
  });

  it('valida nombre y celular en el front sin enviar', async () => {
    const back = fakeProfileBack();
    renderWithQuery(<ProfileView />);
    await screen.findByLabelText('Celular');
    await userEvent.clear(nameField());
    await userEvent.type(nameField(), 'A');
    await userEvent.click(save());
    expect(
      await screen.findByText('El nombre debe tener al menos 2 caracteres.'),
    ).toBeInTheDocument();
    expect(back.patches()).toHaveLength(0);
  });

  it('un 400 del back se pinta en el campo del celular', async () => {
    fakeProfileBack(profileFixture(), {
      patch: {
        status: 400,
        message: [
          'phone debe ser un celular colombiano o un número internacional válido.',
        ],
      },
    });
    renderWithQuery(<ProfileView />);
    await screen.findByLabelText('Celular');
    await userEvent.clear(phoneField());
    await userEvent.type(phoneField(), '+1234567');
    await userEvent.click(save());
    expect(
      await screen.findByText(/phone debe ser un celular colombiano/),
    ).toBeInTheDocument();
    expect(phoneField()).toHaveAttribute('aria-invalid', 'true');
  });

  it('corte de red sin guardar: conserva lo escrito y no reintenta solo', async () => {
    const back = fakeProfileBack(profileFixture(), { patch: 'network' });
    renderWithQuery(<ProfileView />);
    await screen.findByLabelText('Nombre completo');
    await userEvent.type(nameField(), ' M.');
    await userEvent.click(save());
    expect(
      await screen.findByText(/No pudimos confirmar el cambio/),
    ).toBeInTheDocument();
    expect(nameField()).toHaveValue('Ana Pérez M.');
    expect(back.patches()).toHaveLength(1);
    expect(save()).toBeEnabled();
  });

  it('corte de red con el cambio ya guardado: lo da por guardado', async () => {
    fakeProfileBack(profileFixture(), { patch: 'network-saved' });
    renderWithQuery(<ProfileView />);
    await screen.findByLabelText('Nombre completo');
    await userEvent.clear(nameField());
    await userEvent.type(nameField(), 'Ana María');
    await userEvent.click(save());
    expect(
      await screen.findByText('Guardamos tus cambios.'),
    ).toBeInTheDocument();
    expect(nameField()).toHaveValue('Ana María');
  });
});
