import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithQuery } from '../../../tests/utils/render';
import { OrdersView } from './orders-view';

afterEach(() => vi.unstubAllGlobals());

const make = (number: number, over: Record<string, unknown> = {}) => ({
  id: `o${number}`,
  number,
  status: 'recibido',
  total: 9000,
  createdAt: '2026-11-10T17:31:00Z',
  items: [{ productId: 'p', name: 'Capuchino', quantity: 2 }],
  ...over,
});
const page = (n: number, totalPages: number, data: unknown[]) => ({
  page: n,
  limit: 10,
  total: 12,
  totalPages,
  data,
});

describe('OrdersView', () => {
  it('lista los pedidos con número, estado, fecha de Bogotá, total y cantidad', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          page(1, 1, [make(1002, { status: 'en_camino' }), make(1001)]),
        ),
      ),
    );
    renderWithQuery(<OrdersView />);
    const links = await screen.findAllByRole('link', { name: /Pedido #/ });
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveTextContent('Pedido #1002');
    expect(links[0]).toHaveTextContent('En camino');
    expect(links[0]).toHaveTextContent('2 productos');
    expect(links[0]).toHaveTextContent('$9.000');
    expect(links[0]).toHaveTextContent(/12:31/);
    expect(links[0]).toHaveAttribute('href', '/cliente/pedidos/o1002');
    expect(
      screen.queryByRole('button', { name: 'Ver más' }),
    ).not.toBeInTheDocument();
  });

  it('«Ver más» agrega la página siguiente', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(page(1, 2, [make(1002)])))
      .mockResolvedValueOnce(jsonResponse(page(2, 2, [make(1001)])));
    vi.stubGlobal('fetch', f);
    renderWithQuery(<OrdersView />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Ver más' }),
    );
    expect(await screen.findByText('Pedido #1001')).toBeInTheDocument();
    expect(screen.getByText('Pedido #1002')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Ver más' }),
    ).not.toBeInTheDocument();
  });

  it('vacío: invita a ver el menú', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse(page(1, 0, []))),
    );
    renderWithQuery(<OrdersView />);
    expect(
      await screen.findByText('Aún no has hecho pedidos.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver el menú' })).toHaveAttribute(
      'href',
      '/cliente/menu',
    );
  });

  it('error con «Reintentar»', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(
        jsonResponse({ statusCode: 502, message: 'x' }, 502),
      )
      .mockResolvedValueOnce(jsonResponse(page(1, 1, [make(1001)])));
    vi.stubGlobal('fetch', f);
    renderWithQuery(<OrdersView />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Reintentar' }),
    );
    await waitFor(() =>
      expect(screen.getByText('Pedido #1001')).toBeInTheDocument(),
    );
  });
});
