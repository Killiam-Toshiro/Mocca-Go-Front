import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Role } from '@/lib/auth/roles';
import { jsonResponse, renderWithQuery } from '../../tests/utils/render';
import { AppShell } from './app-shell';
import { SessionProvider } from './providers/session-provider';

const navigate = vi.hoisted(() => vi.fn());
const pathname = vi.hoisted(() => ({ value: '/admin' }));
vi.mock('@/lib/browser', () => ({
  navigate,
  currentPath: () => pathname.value,
}));
vi.mock('next/navigation', () => ({ usePathname: () => pathname.value }));

// jsdom no implementa <dialog>.showModal/close.
beforeEach(() => {
  navigate.mockClear();
  pathname.value = '/admin';
  HTMLDialogElement.prototype.showModal = function showModal(
    this: HTMLDialogElement,
  ) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});
afterEach(() => vi.unstubAllGlobals());

function mount(role: Role, username = 'ana') {
  return renderWithQuery(
    <SessionProvider user={{ id: '1', username, role }} expiresAt={null}>
      <AppShell>
        <p>contenido de la página</p>
      </AppShell>
    </SessionProvider>,
  );
}

const sidebar = () =>
  within(screen.getByRole('navigation', { name: 'Principal' }));

describe('AppShell', () => {
  it('muestra marca, usuario, rol y el contenido', () => {
    mount('admin', 'ana');
    expect(
      screen.getAllByRole('link', { name: 'Mocca Go' })[0],
    ).toHaveAttribute('href', '/admin');
    expect(screen.getByText('ana')).toBeInTheDocument();
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent(
      'contenido de la página',
    );
  });

  it('el admin ve sus secciones; las que aún no existen no son enlaces', () => {
    mount('admin');
    expect(sidebar().getByRole('link', { name: 'Inicio' })).toHaveAttribute(
      'href',
      '/admin',
    );
    expect(sidebar().getByRole('link', { name: 'Inicio' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(sidebar().getByRole('link', { name: 'Usuarios' })).toHaveAttribute(
      'href',
      '/admin/usuarios',
    );
    expect(sidebar().getByRole('link', { name: 'Mi cuenta' })).toHaveAttribute(
      'href',
      '/admin/cuenta',
    );
    expect(
      sidebar().queryByRole('link', { name: 'Catálogo' }),
    ).not.toBeInTheDocument();
    const catalogo = sidebar().getByText('Catálogo').closest('[aria-disabled]');
    expect(catalogo).toHaveAttribute('aria-disabled', 'true');
    expect(sidebar().getAllByText('Próximamente')).toHaveLength(5);
  });

  it.each([
    ['cliente', 'Mis pedidos', 'Usuarios'],
    ['operador', 'Cocina', 'Mis pedidos'],
    ['repartidor', 'Mis rondas', 'Cocina'],
  ] as const)('%s ve «%s» y no «%s» (CA-19)', (role, present, absent) => {
    mount(role);
    expect(sidebar().getByText(present)).toBeInTheDocument();
    expect(sidebar().queryByText(absent)).not.toBeInTheDocument();
  });

  it('hay un enlace para saltar al contenido', () => {
    mount('cliente');
    expect(
      screen.getByRole('link', { name: 'Saltar al contenido' }),
    ).toHaveAttribute('href', '#contenido');
  });

  it('«Salir» cierra la sesión y lleva a /login', async () => {
    const fetchMock = vi.fn(async () => jsonResponse(null, 204));
    vi.stubGlobal('fetch', fetchMock);
    mount('cliente');

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: /Salir/ }));

    await vi.waitFor(() => expect(navigate).toHaveBeenCalledWith('/login'));
    const urls = (fetchMock.mock.calls as unknown as [string][]).map(
      ([url]) => url,
    );
    expect(urls).toContain('/api/auth/logout');
  });

  describe('menú móvil', () => {
    it('se abre con el botón y muestra la navegación del rol', async () => {
      mount('operador');
      const user = userEvent.setup();
      const dialog = document.querySelector('dialog')!;
      expect(dialog).not.toHaveAttribute('open');

      await user.click(screen.getByRole('button', { name: 'Abrir menú' }));

      expect(dialog).toHaveAttribute('open');
      const mobile = within(
        screen.getByRole('navigation', { name: 'Navegación móvil' }),
      );
      expect(mobile.getByRole('link', { name: 'Inicio' })).toHaveAttribute(
        'href',
        '/operador',
      );
      expect(mobile.getByText('Cocina')).toBeInTheDocument();
    });

    it('se cierra con «Cerrar menú», con el fondo y al elegir un enlace', async () => {
      mount('operador');
      const user = userEvent.setup();
      const dialog = document.querySelector('dialog')!;

      await user.click(screen.getByRole('button', { name: 'Abrir menú' }));
      await user.click(screen.getByRole('button', { name: 'Cerrar menú' }));
      expect(dialog).not.toHaveAttribute('open');

      await user.click(screen.getByRole('button', { name: 'Abrir menú' }));
      await user.click(dialog); // el fondo es el propio <dialog>
      expect(dialog).not.toHaveAttribute('open');

      await user.click(screen.getByRole('button', { name: 'Abrir menú' }));
      await user.click(within(dialog).getByRole('link', { name: 'Inicio' }));
      expect(dialog).not.toHaveAttribute('open');
    });
  });

  it('en el encabezado, un cliente ve su nombre y no el identificador interno', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ fullName: 'Ana Pérez' })),
    );
    mount('cliente', 'ce7480bdcb8fe4799');
    expect(await screen.findByText('Ana Pérez')).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('ce7480bdcb8fe4799');
  });
});
