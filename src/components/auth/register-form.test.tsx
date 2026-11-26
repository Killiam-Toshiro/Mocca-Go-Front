import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithQuery } from '../../../tests/utils/render';
import { RegisterForm } from './register-form';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@/lib/browser', () => ({ navigate, currentPath: () => '/registro' }));

const PASSWORD = 'Password-123456';
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  navigate.mockClear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

async function fill(
  values: Partial<
    Record<'email' | 'password' | 'fullName' | 'phone', string>
  > = {},
) {
  const data = {
    email: 'ana@example.com',
    password: PASSWORD,
    fullName: 'Ana Pérez',
    phone: '3001234567',
    ...values,
  };
  const user = userEvent.setup();
  const set = async (label: string, value: string) => {
    if (value) await user.type(screen.getByLabelText(label), value);
  };
  await set('Correo', data.email);
  await set('Contraseña', data.password);
  await set('Nombre completo', data.fullName);
  await set('Celular', data.phone);
  await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
  return user;
}

const call = (index: number) => {
  const [url, init] = fetchMock.mock.calls[index] as [string, RequestInit];
  return { url, body: JSON.parse(init.body as string) };
};

describe('RegisterForm', () => {
  it('campos con autocomplete correcto', () => {
    renderWithQuery(<RegisterForm />);
    expect(screen.getByLabelText('Correo')).toHaveAttribute(
      'autocomplete',
      'email',
    );
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute(
      'autocomplete',
      'new-password',
    );
    expect(screen.getByLabelText('Nombre completo')).toHaveAttribute(
      'autocomplete',
      'name',
    );
    expect(screen.getByLabelText('Celular')).toHaveAttribute(
      'autocomplete',
      'tel',
    );
  });

  it('datos inválidos: mensajes por campo y ninguna petición (CA-10)', async () => {
    renderWithQuery(<RegisterForm />);
    await fill({
      email: 'sin-arroba',
      password: 'corta',
      fullName: 'A',
      phone: '',
    });
    expect(
      await screen.findByText('Escribe un correo válido.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('La contraseña debe tener al menos 12 caracteres.'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('El nombre debe tener al menos 2 caracteres.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Escribe tu celular.')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('registro válido: crea la cuenta, inicia sesión sola y va a /cliente (CA-08)', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'c-1' }, 201));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        user: { id: 'c-1', username: 'ana', role: 'cliente' },
        expiresAt: 1,
      }),
    );
    renderWithQuery(<RegisterForm />);
    await fill();

    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/cliente'));
    expect(call(0)).toEqual({
      url: '/api/customers',
      body: {
        email: 'ana@example.com',
        password: PASSWORD,
        fullName: 'Ana Pérez',
        phone: '3001234567',
      },
    });
    expect(call(1)).toEqual({
      url: '/api/auth/login',
      body: { email: 'ana@example.com', password: PASSWORD },
    });
  });

  it('si el login automático falla, va a /login con aviso de cuenta creada', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: 'c-1' }, 201));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ statusCode: 502, message: 'x' }, 502),
    );
    renderWithQuery(<RegisterForm />);
    await fill();
    await waitFor(() =>
      expect(navigate).toHaveBeenCalledWith('/login?registered=1'),
    );
  });

  it('409: el mensaje del servidor va bajo el correo; se conservan los datos menos la contraseña (CA-09)', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { statusCode: 409, message: 'El correo ya está registrado' },
        409,
      ),
    );
    renderWithQuery(<RegisterForm />);
    await fill();

    const message = await screen.findByText('El correo ya está registrado');
    expect(message).toHaveAttribute('id', 'email-error');
    expect(screen.getByLabelText('Correo')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    expect(screen.getByLabelText('Correo')).toHaveValue('ana@example.com');
    expect(screen.getByLabelText('Nombre completo')).toHaveValue('Ana Pérez');
    expect(screen.getByLabelText('Celular')).toHaveValue('3001234567');
    expect(screen.getByLabelText('Contraseña')).toHaveValue('');
    expect(fetchMock).toHaveBeenCalledTimes(1); // no intenta iniciar sesión
    expect(navigate).not.toHaveBeenCalled();
  });

  it('400 con arreglo: lista en una alerta', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(
        { statusCode: 400, message: ['phone no es válido', 'otro'] },
        400,
      ),
    );
    renderWithQuery(<RegisterForm />);
    await fill();
    const alert = await screen.findByRole('alert');
    expect(alert.querySelectorAll('li')).toHaveLength(2);
    expect(alert).toHaveTextContent('phone no es válido');
  });

  it('429 y 502 usan los mensajes fijos', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ statusCode: 429, message: 'x' }, 429),
    );
    renderWithQuery(<RegisterForm />);
    const user = await fill();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Demasiados intentos',
    );

    fetchMock.mockResolvedValueOnce(
      jsonResponse({ statusCode: 502, message: 'x' }, 502),
    );
    await user.type(screen.getByLabelText('Contraseña'), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Crear cuenta' }));
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'No pudimos conectar con el servidor.',
      ),
    );
  });
});
