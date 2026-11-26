import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeProfileBack, profileFixture } from '../../../tests/utils/profile';
import { renderWithQuery } from '../../../tests/utils/render';
import { PasswordForm } from './password-form';

afterEach(() => vi.unstubAllGlobals());

const CURRENT = 'Password-123456';
const NEXT = 'Otra-Clave-98765';
const current = () => screen.getByLabelText('Contraseña actual');
const next = () => screen.getByLabelText('Contraseña nueva');
const repeat = () => screen.getByLabelText('Repite la contraseña nueva');
const submit = () =>
  screen.getByRole('button', { name: /Cambiar contraseña|Cambiando/ });

async function fill(values: { c?: string; n?: string; r?: string } = {}) {
  await userEvent.type(current(), values.c ?? CURRENT);
  await userEvent.type(next(), values.n ?? NEXT);
  await userEvent.type(repeat(), values.r ?? NEXT);
}

describe('PasswordForm', () => {
  it('usa los autocomplete correctos y muestra la ayuda sobre el bloqueo', () => {
    fakeProfileBack();
    renderWithQuery(<PasswordForm />);
    expect(current()).toHaveAttribute('autocomplete', 'current-password');
    expect(next()).toHaveAttribute('autocomplete', 'new-password');
    expect(
      screen.getByText(
        'Si fallas varias veces, la cuenta se bloquea 15 minutos.',
      ),
    ).toBeInTheDocument();
  });

  it('valida en el front: nueva distinta, 12 caracteres y repetición igual', async () => {
    const back = fakeProfileBack();
    renderWithQuery(<PasswordForm />);
    await fill({ n: CURRENT, r: 'otra' });
    await userEvent.click(submit());
    expect(
      await screen.findByText(
        'La contraseña nueva debe ser distinta de la actual.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Las contraseñas no coinciden.'),
    ).toBeInTheDocument();
    expect(back.passwords()).toHaveLength(0);
  });

  it('éxito: envía, vacía los campos, anuncia y enfoca el aviso', async () => {
    const back = fakeProfileBack();
    renderWithQuery(<PasswordForm />);
    await fill();
    await userEvent.click(submit());
    const status = await screen.findByText(/Cambiamos tu contraseña/);
    expect(status).toHaveTextContent('Cerramos tus otras sesiones');
    expect(back.passwords()).toHaveLength(1);
    expect(back.passwords()[0]?.body).toEqual({
      currentPassword: CURRENT,
      newPassword: NEXT,
    });
    expect(current()).toHaveValue('');
    expect(next()).toHaveValue('');
    expect(repeat()).toHaveValue('');
    await waitFor(() => expect(status).toHaveFocus());
  });

  it('403: error en el campo de la actual (que se vacía); la nueva se conserva', async () => {
    fakeProfileBack(profileFixture(), {
      password: {
        status: 403,
        message: 'La contraseña actual no es correcta.',
      },
    });
    renderWithQuery(<PasswordForm />);
    await fill({ c: 'Incorrecta-12345' });
    await userEvent.click(submit());
    expect(
      await screen.findByText('La contraseña actual no es correcta.'),
    ).toBeInTheDocument();
    expect(current()).toHaveValue('');
    expect(current()).toHaveAttribute('aria-invalid', 'true');
    await waitFor(() => expect(current()).toHaveFocus());
    expect(next()).toHaveValue(NEXT);
  });

  it('400 «distinta»: error en el campo de la nueva', async () => {
    fakeProfileBack(profileFixture(), {
      password: {
        status: 400,
        message: 'La contraseña nueva debe ser distinta de la actual.',
      },
    });
    renderWithQuery(<PasswordForm />);
    await fill();
    await userEvent.click(submit());
    await waitFor(() => expect(next()).toHaveAttribute('aria-invalid', 'true'));
  });

  it('429 se muestra tal cual', async () => {
    fakeProfileBack(profileFixture(), {
      password: {
        status: 429,
        message: 'ThrottlerException: Too Many Requests',
      },
    });
    renderWithQuery(<PasswordForm />);
    await fill();
    await userEvent.click(submit());
    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('corte de red: aviso con las dos posibilidades, campos vacíos y sin reintento', async () => {
    const back = fakeProfileBack(profileFixture(), { password: 'network' });
    renderWithQuery(<PasswordForm />);
    await fill();
    await userEvent.click(submit());
    expect(
      await screen.findByText(
        /Si la actual ya no te sirve, prueba con la nueva/,
      ),
    ).toBeInTheDocument();
    expect(current()).toHaveValue('');
    expect(next()).toHaveValue('');
    expect(repeat()).toHaveValue('');
    expect(back.passwords()).toHaveLength(1);
  });
});
