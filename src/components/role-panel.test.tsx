import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { Role } from '@/lib/auth/roles';
import { renderWithQuery } from '../../tests/utils/render';
import { SessionProvider } from './providers/session-provider';
import { RolePanel } from './role-panel';

vi.mock('@/lib/browser', () => ({ navigate: vi.fn(), currentPath: () => '/' }));

const mount = (role: Role) =>
  renderWithQuery(
    <SessionProvider
      user={{ id: '1', username: 'lucia', role }}
      expiresAt={null}
    >
      <RolePanel />
    </SessionProvider>,
  );

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
    expect(section.querySelectorAll('li')).toHaveLength(6);
    expect(section.querySelectorAll('[aria-disabled="true"]')).toHaveLength(6);
    expect(screen.getByText('Usuarios')).toBeInTheDocument();
  });

  it('un cliente no ve secciones de administración', () => {
    mount('cliente');
    expect(screen.queryByText('Usuarios')).not.toBeInTheDocument();
    expect(screen.getByText('Mis pedidos')).toBeInTheDocument();
  });
});
