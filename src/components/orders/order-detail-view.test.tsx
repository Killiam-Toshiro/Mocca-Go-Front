import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonResponse, renderWithQuery } from '../../../tests/utils/render';
import { OrderDetailView } from './order-detail-view';

afterEach(() => vi.unstubAllGlobals());

const base = {
  id: 'o1',
  number: 1001,
  status: 'recibido',
  total: 11500,
  items: [
    {
      productId: 'a',
      sku: 'A',
      name: 'Capuchino',
      category: 'cafe',
      quantity: 2,
      unitPrice: 4500,
      lineTotal: 9000,
      components: [],
    },
    {
      productId: 'c',
      sku: 'C',
      name: 'Combo Clásico',
      category: 'combo',
      quantity: 1,
      unitPrice: 2500,
      lineTotal: 2500,
      components: [
        { productId: 'x', sku: 'X', name: 'Pandebono', quantity: 2 },
      ],
    },
  ],
  delivery: {
    pointId: 'p',
    pointName: 'Edificio A',
    zoneName: 'Zona 1',
    floor: 2,
    deliveryNote: 'Salón 302',
    etaAt: null,
    courier: null,
  },
  note: 'Sin azúcar',
  payment: { method: 'tarjeta_demo', last4: '4242', status: 'aprobado' },
  customer: { name: 'Ana', phone: '+57' },
  cancelReason: null,
  failureReason: null,
  survey: null,
  events: [{ status: 'recibido', at: '2026-11-10T17:31:00Z' }],
  createdAt: '2026-11-10T17:31:00Z',
  updatedAt: '2026-11-10T17:31:00Z',
};
const serve = (order: unknown, status = 200) =>
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => jsonResponse(order, status)),
  );

describe('OrderDetailView', () => {
  it('muestra productos con componentes, total, entrega, pago e historial', async () => {
    serve(base);
    renderWithQuery(<OrderDetailView id="o1" />);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Pedido #1001' }),
    ).toBeInTheDocument();
    expect(screen.getByText('2 × Capuchino')).toBeInTheDocument();
    expect(screen.getByText(/Incluye: 2 × Pandebono/)).toBeInTheDocument();
    expect(screen.getByText('$11.500')).toBeInTheDocument();
    expect(
      screen.getByText(/Zona 1 · Edificio A · Piso 2/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Indicación: Salón 302/)).toBeInTheDocument();
    expect(screen.getByText(/Nota: Sin azúcar/)).toBeInTheDocument();
    expect(screen.getByText(/···· 4242/)).toHaveTextContent('Aprobado');
    const history = screen.getByRole('list', { name: 'Historial del pedido' });
    expect(within(history).getByText('Recibido')).toBeInTheDocument();
    expect(within(history).getByText(/12:31/)).toBeInTheDocument();
  });

  it('con ?nuevo=1 celebra, anuncia y enfoca el título', async () => {
    serve(base);
    renderWithQuery(<OrderDetailView id="o1" isNew />);
    expect(
      await screen.findByText(/¡Pedido #1001 recibido!/),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('heading', { level: 1 })).toHaveFocus(),
    );
  });

  it('un pedido ajeno o inexistente (404) dice que no lo encontró', async () => {
    serve({ statusCode: 404, message: 'x' }, 404);
    renderWithQuery(<OrderDetailView id="otro" />);
    expect(
      await screen.findByText('No encontramos este pedido.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ver mis pedidos' }),
    ).toHaveAttribute('href', '/cliente/pedidos');
  });

  it('un error de red ofrece «Reintentar»', async () => {
    serve({ statusCode: 502, message: 'x' }, 502);
    renderWithQuery(<OrderDetailView id="o1" />);
    expect(
      await screen.findByRole(
        'button',
        { name: 'Reintentar' },
        { timeout: 4000 },
      ),
    ).toBeInTheDocument();
  });

  it('en «en_camino» muestra repartidor, hora estimada y WhatsApp válido', async () => {
    serve({
      ...base,
      status: 'en_camino',
      delivery: {
        ...base.delivery,
        etaAt: '2026-11-10T17:45:00Z',
        courier: {
          fullName: 'Carlos Gómez',
          phone: '+573001234500',
          whatsappUrl: 'https://wa.me/573001234500',
        },
      },
      events: [
        ...base.events,
        { status: 'en_camino', at: '2026-11-10T17:40:00Z' },
      ],
    });
    renderWithQuery(<OrderDetailView id="o1" />);
    expect(await screen.findByText('Carlos Gómez')).toBeInTheDocument();
    expect(screen.getByText(/12:45/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /WhatsApp/ })).toHaveAttribute(
      'href',
      'https://wa.me/573001234500',
    );
    expect(
      screen.queryByRole('button', { name: 'Cancelar pedido' }),
    ).not.toBeInTheDocument();
  });

  it('un WhatsApp que no es wa.me no se enlaza', async () => {
    serve({
      ...base,
      status: 'en_camino',
      delivery: {
        ...base.delivery,
        etaAt: null,
        courier: {
          fullName: 'Carlos',
          phone: '+57300',
          whatsappUrl: 'https://evil.example/x',
        },
      },
    });
    renderWithQuery(<OrderDetailView id="o1" />);
    await screen.findByText('Carlos');
    expect(
      screen.queryByRole('link', { name: /WhatsApp/ }),
    ).not.toBeInTheDocument();
  });

  it('muestra el motivo de cancelación y el reembolso', async () => {
    serve({
      ...base,
      status: 'cancelado',
      cancelReason: 'El cliente lo pidió',
      payment: { ...base.payment, status: 'reembolsado' },
    });
    renderWithQuery(<OrderDetailView id="o1" />);
    expect(
      await screen.findByText(/Motivo de la cancelación: El cliente lo pidió/),
    ).toBeInTheDocument();
    expect(screen.getByText(/···· 4242/)).toHaveTextContent('Reembolsado');
  });

  it('muestra el motivo de no entrega', async () => {
    serve({ ...base, status: 'no_entregado', failureReason: 'Nadie recibió' });
    renderWithQuery(<OrderDetailView id="o1" />);
    expect(
      await screen.findByText(/No pudimos entregar tu pedido: Nadie recibió/),
    ).toBeInTheDocument();
  });
});

describe('cancelar', () => {
  it('solo en «recibido»; pide confirmación y deja el pedido cancelado y reembolsado', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(base))
      .mockResolvedValueOnce(
        jsonResponse({
          ...base,
          status: 'cancelado',
          payment: { ...base.payment, status: 'reembolsado' },
          events: [
            ...base.events,
            { status: 'cancelado', at: '2026-11-10T17:35:00Z' },
          ],
        }),
      );
    vi.stubGlobal('fetch', f);
    renderWithQuery(<OrderDetailView id="o1" />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Cancelar pedido' }),
    );
    expect(f).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole('button', { name: 'Sí, cancelar' }));
    // Estado en la cabecera y en el historial.
    expect(await screen.findAllByText('Cancelado')).toHaveLength(2);
    expect(screen.getByText(/···· 4242/)).toHaveTextContent('Reembolsado');
    expect(
      screen.queryByRole('button', { name: 'Cancelar pedido' }),
    ).not.toBeInTheDocument();
    expect((f.mock.calls[1] as unknown as [string, RequestInit])[0]).toBe(
      '/api/orders/o1/cancel',
    );
  });

  it('«No» cierra la confirmación sin llamar al servidor', async () => {
    const f = vi.fn(async () => jsonResponse(base));
    vi.stubGlobal('fetch', f);
    renderWithQuery(<OrderDetailView id="o1" />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Cancelar pedido' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'No' }));
    expect(
      screen.getByRole('button', { name: 'Cancelar pedido' }),
    ).toBeInTheDocument();
    expect(f).toHaveBeenCalledTimes(1);
  });

  it('un 409 explica que ya no se puede y trae el estado real', async () => {
    const f = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse(base))
      .mockResolvedValueOnce(
        jsonResponse({ statusCode: 409, message: 'x' }, 409),
      )
      .mockResolvedValue(jsonResponse({ ...base, status: 'en_preparacion' }));
    vi.stubGlobal('fetch', f);
    renderWithQuery(<OrderDetailView id="o1" />);
    await userEvent.click(
      await screen.findByRole('button', { name: 'Cancelar pedido' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Sí, cancelar' }));
    expect(
      await screen.findByText(/ya entró a preparación/),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(
        screen.getByText('En preparación', { selector: 'span' }),
      ).toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('button', { name: 'Cancelar pedido' }),
    ).not.toBeInTheDocument();
  });
});
