import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@/lib/auth/roles';
import { jsonResponse, renderWithQuery } from '../../tests/utils/render';
import { SessionProvider } from './providers/session-provider';
import { RolePanel } from './role-panel';

vi.mock('@/lib/browser', () => ({ navigate: vi.fn(), currentPath: () => '/' }));

const mount = (role: Role, username = 'lucia') =>
  renderWithQuery(
    <SessionProvider user={{ id: '1', username, role }} expiresAt={null}>
      <RolePanel />
    </SessionProvider>,
  );

afterEach(() => vi.unstubAllGlobals());

describe('RolePanel', () => {
  it('saluda por el nombre y dice el rol', () => {
    mount('repartidor');
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      'Hola, lucia',
    );
    expect(screen.getByText('Repartidor')).toBeInTheDocument();
  });

  it('lista las secciones futuras del rol como deshabilitadas', () => {
    mount('admin');
    const section = screen.getByRole('region', { name: 'Próximamente' });
    expect(section.querySelectorAll('li')).toHaveLength(3);
    expect(section.querySelectorAll('[aria-disabled="true"]')).toHaveLength(3);
    expect(screen.getByText('Zonas y puntos')).toBeInTheDocument();
    // «Usuarios» (007a), «Catálogo» (007b) y «Pedidos» (007d) ya existen: no figuran entre las secciones futuras.
    expect(screen.queryByText('Usuarios')).not.toBeInTheDocument();
    expect(screen.queryByText('Catálogo')).not.toBeInTheDocument();
    expect(screen.queryByText('Pedidos')).not.toBeInTheDocument();
  });

  it('un cliente no ve secciones de administración', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ fullName: 'Ana' })),
    );
    mount('cliente');
    expect(screen.queryByText('Usuarios')).not.toBeInTheDocument();
    // «Mi perfil» ya existe (006): no figura entre las secciones futuras.
    expect(screen.queryByText('Mi perfil')).not.toBeInTheDocument();
  });

  describe('nombre del cliente (P-03)', () => {
    const INTERNO = 'ce7480bdcb8fe4799';

    it('muestra el nombre completo y nunca el identificador interno', async () => {
      const fetchMock = vi.fn(async () =>
        jsonResponse({ fullName: ' Ana Pérez ' }),
      );
      vi.stubGlobal('fetch', fetchMock);
      mount('cliente', INTERNO);
      await vi.waitFor(() =>
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
          'Hola, Ana Pérez',
        ),
      );
      expect(document.body).not.toHaveTextContent(INTERNO);
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const [url, init] = fetchMock.mock.calls[0] as unknown as [
        string,
        RequestInit,
      ];
      expect(url).toBe('/api/customers/me');
      expect(init.method).toBe('GET');
    });

    it('mientras llega el nombre, y si falla, saluda sin nombre', async () => {
      vi.stubGlobal(
        'fetch',
        vi.fn(async () => jsonResponse({ message: 'x' }, 500)),
      );
      mount('cliente', INTERNO);
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        /^Hola$/,
      );
      await vi.waitFor(() =>
        expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
          /^Hola$/,
        ),
      );
      expect(document.body).not.toHaveTextContent(INTERNO);
    });

    it('el personal usa su usuario y no consulta el perfil de cliente', () => {
      const fetchMock = vi.fn();
      vi.stubGlobal('fetch', fetchMock);
      mount('operador', 'operador');
      expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
        'Hola, operador',
      );
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });
});
