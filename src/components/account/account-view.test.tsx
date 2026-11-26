import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeProfileBack } from '../../../tests/utils/profile';
import { renderWithQuery } from '../../../tests/utils/render';
import { AccountView } from './account-view';

vi.mock('@/components/providers/session-provider', () => ({
  useSession: () => ({
    user: { id: 'u-op', username: 'operador', role: 'operador' },
    expiresAt: null,
  }),
}));

afterEach(() => vi.unstubAllGlobals());

describe('AccountView', () => {
  it('muestra el usuario y el rol del personal y el cambio de contraseña', () => {
    fakeProfileBack();
    renderWithQuery(<AccountView />);
    expect(
      screen.getByRole('heading', { name: 'Mi cuenta' }),
    ).toBeInTheDocument();
    expect(screen.getByText('operador')).toBeInTheDocument();
    expect(screen.getByText('Operador')).toBeInTheDocument();
    expect(
      screen.getByRole('form', { name: 'Cambiar contraseña' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/cámbiala por una tuya/)).toBeInTheDocument();
  });

  it('cambia la contraseña con PATCH /auth/password (la clave genérica como actual)', async () => {
    const back = fakeProfileBack();
    renderWithQuery(<AccountView />);
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText('Contraseña actual'),
      'clave-generica',
    );
    await user.type(
      screen.getByLabelText('Contraseña nueva'),
      'Otra-Clave-98765',
    );
    await user.type(
      screen.getByLabelText('Repite la contraseña nueva'),
      'Otra-Clave-98765',
    );
    await user.click(
      screen.getByRole('button', { name: 'Cambiar contraseña' }),
    );
    await waitFor(() => expect(back.passwords()).toHaveLength(1));
    expect(back.passwords()[0]?.body).toEqual({
      currentPassword: 'clave-generica',
      newPassword: 'Otra-Clave-98765',
    });
    expect(
      await screen.findByText(/Cambiamos tu contraseña/),
    ).toBeInTheDocument();
  });

  it('el 403 se explica en el campo de la contraseña actual', async () => {
    fakeProfileBack(undefined, {
      password: {
        status: 403,
        message: 'La contraseña actual no es correcta.',
      },
    });
    renderWithQuery(<AccountView />);
    const user = userEvent.setup();
    await user.type(
      screen.getByLabelText('Contraseña actual'),
      'clave-incorrecta',
    );
    await user.type(
      screen.getByLabelText('Contraseña nueva'),
      'Otra-Clave-98765',
    );
    await user.type(
      screen.getByLabelText('Repite la contraseña nueva'),
      'Otra-Clave-98765',
    );
    await user.click(
      screen.getByRole('button', { name: 'Cambiar contraseña' }),
    );
    expect(
      await screen.findByText('La contraseña actual no es correcta.'),
    ).toBeInTheDocument();
  });
});
