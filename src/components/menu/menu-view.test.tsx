import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { clearCart, resetCartStoreForTests, addToCart } from '@/lib/cart/store';
import { resetStorageForTests } from '@/lib/cart/storage';
import type { MenuItem } from '@/lib/menu/categories';
import { jsonResponse, renderWithQuery } from '../../../tests/utils/render';
import { MenuView } from './menu-view';

function item(
  over: Partial<MenuItem> & Pick<MenuItem, 'id' | 'name'>,
): MenuItem {
  return {
    sku: over.id.toUpperCase(),
    description: null,
    category: 'cafe',
    price: 4500,
    available: true,
    components: [],
    ...over,
  } as MenuItem;
}

const CAPU = item({
  id: 'capu',
  name: 'Capuchino',
  description: 'Café con leche',
});
const PAN = item({
  id: 'pan',
  name: 'Pandebono',
  category: 'panaderia',
  price: 2500,
});
const TRES = item({
  id: 'tres',
  name: 'Tres leches',
  category: 'pasteleria',
  price: 6000,
  available: false,
});

function serve(menu: MenuItem[]) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse({ data: menu })),
  );
}

beforeEach(() => {
  resetStorageForTests();
  resetCartStoreForTests();
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
afterEach(() => {
  clearCart();
  vi.unstubAllGlobals();
});

describe('MenuView', () => {
  it('agrupa por categoría y marca los agotados', async () => {
    serve([CAPU, PAN, TRES]);
    renderWithQuery(<MenuView audience="visitante" />);
    expect(
      await screen.findByRole('heading', { level: 2, name: 'Cafés' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { level: 2, name: 'Panadería' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Agotado')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Agregar Tres leches al carrito' }),
    ).not.toBeInTheDocument();
  });

  it('el filtro deja una sola categoría', async () => {
    serve([CAPU, PAN]);
    renderWithQuery(<MenuView audience="visitante" />);
    await screen.findByText('Capuchino');
    await userEvent.click(screen.getByRole('button', { name: 'Panadería' }));
    expect(screen.queryByText('Capuchino')).not.toBeInTheDocument();
    expect(screen.getByText('Pandebono')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Todo' }));
    expect(screen.getByText('Capuchino')).toBeInTheDocument();
  });

  it('agregar suma al carrito y el total sale en el panel; un visitante ve «Ingresar para pedir»', async () => {
    serve([CAPU, PAN]);
    renderWithQuery(<MenuView audience="visitante" />);
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Agregar Capuchino al carrito',
      }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Agregar Capuchino al carrito' }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Abrir carrito, 2/ }),
    );
    const panel = screen.getByRole('dialog', { name: 'Tu carrito' });
    // Total de la línea y total general.
    expect(within(panel).getAllByText('$9.000')).toHaveLength(2);
    expect(
      within(panel).getByRole('link', { name: 'Ingresar para pedir' }),
    ).toHaveAttribute('href', '/login?next=/cliente/menu');
  });

  it('un cliente ve «Continuar» como enlace al pedido', async () => {
    serve([CAPU]);
    renderWithQuery(<MenuView audience="cliente" />);
    await userEvent.click(
      await screen.findByRole('button', {
        name: 'Agregar Capuchino al carrito',
      }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Abrir carrito/ }),
    );
    expect(screen.getByRole('link', { name: 'Continuar' })).toHaveAttribute(
      'href',
      '/cliente/pedido',
    );
  });

  it('con un agotado en el carrito, «Continuar» queda deshabilitado', async () => {
    addToCart({ id: 'tres', name: 'Tres leches', price: 6000 }, 1);
    serve([CAPU, TRES]);
    renderWithQuery(<MenuView audience="cliente" />);
    await screen.findByText('Capuchino');
    await userEvent.click(
      screen.getByRole('button', { name: /Abrir carrito/ }),
    );
    expect(screen.getByRole('button', { name: 'Continuar' })).toBeDisabled();
  });

  it('avisa si llegó con el carrito vacío', async () => {
    serve([CAPU]);
    renderWithQuery(<MenuView audience="cliente" emptyCartNotice />);
    expect(
      await screen.findByText(/Tu carrito está vacío/),
    ).toBeInTheDocument();
  });

  it('el personal no ve carrito ni botones de agregar', async () => {
    serve([CAPU]);
    renderWithQuery(<MenuView audience="personal" />);
    await screen.findByText('Capuchino');
    expect(
      screen.queryByRole('button', { name: /carrito/i }),
    ).not.toBeInTheDocument();
  });

  it('un producto retirado se quita del carrito con aviso', async () => {
    addToCart({ id: 'viejo', name: 'Pastel viejo', price: 3000 }, 1);
    serve([CAPU]);
    renderWithQuery(<MenuView audience="cliente" />);
    await screen.findByText('Capuchino');
    await userEvent.click(
      screen.getByRole('button', { name: /Abrir carrito/ }),
    );
    expect(
      await screen.findByText(/Pastel viejo ya no está en el menú/),
    ).toBeInTheDocument();
  });

  it('un agotado en el carrito bloquea el total y avisa', async () => {
    addToCart({ id: 'tres', name: 'Tres leches', price: 6000 }, 1);
    serve([CAPU, TRES]);
    renderWithQuery(<MenuView audience="visitante" />);
    await screen.findByText('Capuchino');
    await userEvent.click(
      screen.getByRole('button', { name: /Abrir carrito/ }),
    );
    expect(
      await screen.findByText(/Quita los productos agotados/),
    ).toBeInTheDocument();
  });

  it('muestra el error con «Reintentar»', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ statusCode: 502, message: 'x' }, 502)),
    );
    renderWithQuery(<MenuView audience="visitante" />);
    expect(
      await screen.findByRole(
        'button',
        { name: 'Reintentar' },
        { timeout: 4000 },
      ),
    ).toBeInTheDocument();
  });

  it('menú vacío', async () => {
    serve([]);
    renderWithQuery(<MenuView audience="visitante" />);
    expect(
      await screen.findByText('Hoy no hay productos disponibles.'),
    ).toBeInTheDocument();
  });
});
