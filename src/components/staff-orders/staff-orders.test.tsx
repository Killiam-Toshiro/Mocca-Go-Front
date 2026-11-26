import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '@/lib/orders/types';
import { kitchenOrder, kitchenPage } from '../../../tests/utils/kitchen';
import { jsonResponse, renderWithQuery } from '../../../tests/utils/render';
import { StaffOrderDetail } from './staff-order-detail';
import { StaffOrdersView } from './staff-orders-view';

afterEach(() => vi.unstubAllGlobals());

describe('StaffOrdersView', () => {
  it('lista pedidos con cliente, estado y enlace al detalle del rol', async () => {
    const a = kitchenOrder({ number: 1002, status: 'en_camino' });
    const b = kitchenOrder({
      number: 1001,
      customer: { name: 'Ana Pérez', phone: '+573001112233' },
    });
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        jsonResponse({ ...kitchenPage([a, b]), limit: 20 }),
      ),
    );
    renderWithQuery(<StaffOrdersView base="/operador" />);
    expect(await screen.findByText('Pedido #1002')).toBeInTheDocument();
    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('2 pedidos')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Pedido #1001/ })).toHaveAttribute(
      'href',
      `/operador/pedidos/${b.id}`,
    );
  });

  it('el filtro de estado vuelve a pedir al back con ese estado', async () => {
    const f = vi.fn<typeof fetch>(async () =>
      jsonResponse({ ...kitchenPage([]), limit: 20 }),
    );
    vi.stubGlobal('fetch', f);
    renderWithQuery(<StaffOrdersView base="/admin" />);
    expect(
      await screen.findByText('No hay pedidos con este estado.'),
    ).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'cancelado');
    await waitFor(() =>
      expect(f.mock.calls.at(-1)?.[0]).toBe(
        '/api/orders?page=1&limit=20&status=cancelado',
      ),
    );
  });

  it('un error se muestra con «Reintentar»', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        jsonResponse({ statusCode: 403, message: 'Sin permiso.' }, 403),
      ),
    );
    renderWithQuery(<StaffOrdersView base="/admin" />);
    expect(
      await screen.findByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument();
  });
});

describe('StaffOrderDetail', () => {
  function stubOrder(order: Order, cancelStatus = 200) {
    const posts: unknown[] = [];
    const f = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.method === 'POST') {
        posts.push(JSON.parse(String(init.body)));
        return cancelStatus === 200
          ? jsonResponse({ ...order, status: 'cancelado' })
          : jsonResponse(
              { statusCode: cancelStatus, message: 'x' },
              cancelStatus,
            );
      }
      return jsonResponse(order);
    });
    vi.stubGlobal('fetch', f);
    return posts;
  }

  it('muestra cliente con contacto, productos, entrega, pago e historial', async () => {
    stubOrder(kitchenOrder({ number: 1005 }));
    renderWithQuery(<StaffOrderDetail id="x" base="/admin" />);
    expect(
      await screen.findByRole('heading', { name: 'Pedido #1005' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Carlos Sarmiento')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Llamar/ })).toHaveAttribute(
      'href',
      'tel:+573005874455',
    );
    expect(screen.getByText('2 × Capuchino (caliente)')).toBeInTheDocument();
    expect(
      screen.getByText('Zona 1 · Edificio A · Piso 2'),
    ).toBeInTheDocument();
    expect(screen.getByText(/····\s*4242/)).toBeInTheDocument();
    expect(
      screen.getByRole('list', { name: 'Historial del pedido' }),
    ).toBeInTheDocument();
  });

  it('cancela con motivo desde el detalle (solo recibido o en preparación)', async () => {
    const posts = stubOrder(kitchenOrder({ number: 1006 }));
    renderWithQuery(<StaffOrderDetail id="x" base="/admin" />);
    await userEvent.click(
      await screen.findByRole('button', { name: /Cancelar el pedido 1006/ }),
    );
    await userEvent.type(
      screen.getByLabelText(/Motivo de la cancelación/),
      'Sin insumos',
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirmar cancelación' }),
    );
    await waitFor(() => expect(posts).toEqual([{ reason: 'Sin insumos' }]));
  });

  it('un pedido listo o entregado no ofrece cancelar', async () => {
    stubOrder(kitchenOrder({ status: 'entregado' }));
    renderWithQuery(<StaffOrderDetail id="x" base="/admin" />);
    await screen.findByRole('heading', { name: /Pedido #/ });
    expect(
      screen.queryByRole('button', { name: /Cancelar el pedido/ }),
    ).not.toBeInTheDocument();
  });

  it('si otro operador ya lo cambió (409) avisa con «Entendido»', async () => {
    stubOrder(kitchenOrder({ number: 1007 }), 409);
    renderWithQuery(<StaffOrderDetail id="x" base="/admin" />);
    await userEvent.click(
      await screen.findByRole('button', { name: /Cancelar el pedido 1007/ }),
    );
    await userEvent.type(screen.getByLabelText(/Motivo/), 'x');
    await userEvent.click(
      screen.getByRole('button', { name: 'Confirmar cancelación' }),
    );
    const notice = await screen.findByRole('status');
    expect(
      within(notice).getByText(/ya cambió este pedido/),
    ).toBeInTheDocument();
    await userEvent.click(
      within(notice).getByRole('button', { name: 'Entendido' }),
    );
    expect(screen.queryByText(/ya cambió este pedido/)).not.toBeInTheDocument();
  });

  it('un pedido inexistente muestra «No encontramos este pedido.»', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        jsonResponse(
          { statusCode: 404, message: 'Pedido no encontrado.' },
          404,
        ),
      ),
    );
    renderWithQuery(<StaffOrderDetail id="x" base="/operador" />);
    expect(
      await screen.findByText('No encontramos este pedido.'),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ver pedidos' })).toHaveAttribute(
      'href',
      '/operador/pedidos',
    );
  });
});
