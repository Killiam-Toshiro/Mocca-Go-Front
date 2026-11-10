import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithQuery } from '../../../tests/utils/render';
import { LoginForm } from './login-form';

const navigate = vi.hoisted(() => vi.fn());
vi.mock('@/lib/browser', () => ({ navigate, currentPath: () => '/login' }));

const PASSWORD = 'Password-123456';
let fetchMock: ReturnType<typeof vi.fn>;

const loginAs = (role: string, username = 'x') =>
  jsonResponse({ user: { id: '1', username, role }, expiresAt: 1 });

beforeEach(() => {
  navigate.mockClear();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});
afterEach(() => vi.unstubAllGlobals());

async function fill(identifier: string, password = PASSWORD) {
  const user = userEvent.setup();
  if (identifier)
    await user.type(screen.getByLabelText('Usuario o correo'), identifier);
  if (password) await user.type(screen.getByLabelText('Contraseña'), password);
  await user.click(screen.getByRole('button', { name: 'Ingresar' }));
  return user;
}

const sentBody = () =>
  JSON.parse(
    (fetchMock.mock.calls[0] as [string, RequestInit])[1].body as string,
  );

describe('LoginForm', () => {
  it('campos accesibles con autocomplete correcto', () => {
    renderWithQuery(<LoginForm />);
    expect(screen.getByLabelText('Usuario o correo')).toHaveAttribute(
      'autocomplete',
      'username',
    );
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute(
      'type',
      'password',
    );
  });

  it('mostrar/ocultar la contraseña', async () => {
    renderWithQuery(<LoginForm />);
    const user = userEvent.setup();
    const toggle = screen.getByRole('button', { name: 'Mostrar contraseña' });
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    await user.click(toggle);
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('type', 'text');
    expect(
      screen.getByRole('button', { name: 'Ocultar contraseña' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('vacío: muestra mensajes por campo, los asocia con aria y no envía nada (CA-10)', async () => {
    renderWithQuery(<LoginForm />);
    await fill('', '');
    expect(
      await screen.findByText('Escribe tu usuario o correo.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Escribe tu contraseña.')).toBeInTheDocument();
    const field = screen.getByLabelText('Usuario o correo');
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAttribute('aria-describedby', 'identifier-error');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('usuario del personal: envía username en minúsculas y va al home del rol (CA-04)', async () => {
    fetchMock.mockResolvedValue(loginAs('operador'));
    renderWithQuery(<LoginForm />);
    await fill('Operador');
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/operador'));
    expect(fetchMock.mock.calls[0]![0]).toBe('/api/auth/login');
    expect(sentBody()).toEqual({ username: 'operador', password: PASSWORD });
  });

  it('correo de cliente: envía email y va a /cliente (CA-06)', async () => {
    fetchMock.mockResolvedValue(loginAs('cliente'));
    renderWithQuery(<LoginForm />);
    await fill('cliente@example.com');
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/cliente'));
    expect(sentBody()).toEqual({
      email: 'cliente@example.com',
      password: PASSWORD,
    });
  });

  it.each([
    ['/admin/usuarios', 'admin', '/admin/usuarios'],
    ['/admin', 'cliente', '/cliente'],
    ['https://evil.test', 'admin', '/admin'],
    ['//evil.test', 'admin', '/admin'],
    [undefined, 'repartidor', '/repartidor'],
  ])('next %j con rol %s → %s (CA-14)', async (next, role, expected) => {
    fetchMock.mockResolvedValue(loginAs(role));
    renderWithQuery(<LoginForm next={next} />);
    await fill('alguien');
    await waitFor(() => expect(navigate).toHaveBeenCalledWith(expected));
  });

  it('mientras envía, el botón queda deshabilitado', async () => {
    let release: (r: Response) => void = () => undefined;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => (release = resolve)),
    );
    renderWithQuery(<LoginForm />);
    await fill('admin');
    const button = await screen.findByRole('button', { name: /Ingresando/ });
    expect(button).toBeDisabled();
    release(loginAs('admin'));
    await waitFor(() => expect(navigate).toHaveBeenCalled());
  });

  describe('errores del servidor (CA-07)', () => {
    it('401: mensaje del back, conserva el usuario y pide de nuevo la contraseña', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse(
          { statusCode: 401, message: 'Credenciales inválidas' },
          401,
        ),
      );
      renderWithQuery(<LoginForm />);
      await fill('admin');
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Credenciales inválidas',
      );
      expect(screen.getByLabelText('Usuario o correo')).toHaveValue('admin');
      expect(screen.getByLabelText('Contraseña')).toHaveValue('');
      expect(screen.getByLabelText('Contraseña')).toHaveFocus();
      expect(navigate).not.toHaveBeenCalled();
    });

    it('400 con arreglo: una lista', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ statusCode: 400, message: ['uno', 'dos'] }, 400),
      );
      renderWithQuery(<LoginForm />);
      await fill('admin');
      const alert = await screen.findByRole('alert');
      expect(alert.querySelectorAll('li')).toHaveLength(2);
    });

    it('429: mensaje fijo', async () => {
      fetchMock.mockResolvedValue(
        jsonResponse({ statusCode: 429, message: 'ThrottlerException' }, 429),
      );
      renderWithQuery(<LoginForm />);
      await fill('admin');
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Demasiados intentos, espera un momento e inténtalo de nuevo.',
      );
    });

    it.each([502, 504])(
      '%s: «No pudimos conectar con el servidor»',
      async (status) => {
        fetchMock.mockResolvedValue(
          jsonResponse({ statusCode: status, message: 'x' }, status),
        );
        renderWithQuery(<LoginForm />);
        await fill('admin');
        expect(await screen.findByRole('alert')).toHaveTextContent(
          'No pudimos conectar con el servidor.',
        );
      },
    );

    it('sin red: mismo mensaje', async () => {
      fetchMock.mockRejectedValue(new TypeError('sin red'));
      renderWithQuery(<LoginForm />);
      await fill('admin');
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No pudimos conectar con el servidor.',
      );
    });

    it('el error se borra al reintentar', async () => {
      fetchMock.mockResolvedValueOnce(
        jsonResponse(
          { statusCode: 401, message: 'Credenciales inválidas' },
          401,
        ),
      );
      fetchMock.mockResolvedValueOnce(loginAs('admin'));
      renderWithQuery(<LoginForm />);
      const user = await fill('admin');
      await screen.findByText('Credenciales inválidas');
      await user.type(screen.getByLabelText('Contraseña'), PASSWORD);
      await user.click(screen.getByRole('button', { name: 'Ingresar' }));
      await waitFor(() => expect(navigate).toHaveBeenCalledWith('/admin'));
      expect(
        screen.queryByText('Credenciales inválidas'),
      ).not.toBeInTheDocument();
    });
  });

  it('avisos de sesión vencida y de cuenta creada', () => {
    const { unmount } = renderWithQuery(<LoginForm expired />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Tu sesión venció. Inicia sesión de nuevo.',
    );
    unmount();
    renderWithQuery(<LoginForm registered />);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Tu cuenta fue creada. Inicia sesión para continuar.',
    );
  });
});
