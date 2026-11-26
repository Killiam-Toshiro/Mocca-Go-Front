import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Order } from '@/lib/orders/types';
import { kitchenOrder } from '../../../tests/utils/kitchen';
import { jsonResponse, renderWithQuery } from '../../../tests/utils/render';
import { KitchenView } from './kitchen-view';

afterEach(() => vi.unstubAllGlobals());

type Queues = Record<'recibido' | 'en_preparacion' | 'listo', Order[]>;

/** Un back de cocina falso con estado: lista las colas y mueve pedidos al empezar o marcar listo. */
function fakeKitchen(
  initial: Partial<Queues>,
  opts: { failAction?: number } = {},
) {
  const queues: Queues = {
    recibido: [],
    en_preparacion: [],
    listo: [],
    ...initial,
  };
  const posts: { url: string; body: unknown }[] = [];
  const fetchMock = vi.fn<typeof fetch>(async (input, init) => {
    const url = String(input);
    const method = init?.method ?? 'GET';
    if (method === 'GET') {
      const status = new URL(url, 'http://x').searchParams.get(
        'status',
      ) as keyof Queues;
      const data = queues[status];
      return jsonResponse({
        page: 1,
        limit: 100,
        total: data.length,
        totalPages: 1,
        data,
      });
    }
    posts.push({
      url,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    });
    if (opts.failAction)
      return jsonResponse(
        { statusCode: opts.failAction, message: 'x' },
        opts.failAction,
      );
    const move = /\/kitchen\/orders\/([^/]+)\/(start|ready)$/.exec(url);
    if (move) {
      const [, id, action] = move;
      const from = action === 'start' ? 'recibido' : 'en_preparacion';
      const to = action === 'start' ? 'en_preparacion' : 'listo';
      const order = queues[from].find((o) => o.id === id)!;
      queues[from] = queues[from].filter((o) => o.id !== id);
      const moved = { ...order, status: to } as Order;
      queues[to] = [...queues[to], moved];
      return jsonResponse(moved);
    }
    const cancel = /\/orders\/([^/]+)\/cancel$/.exec(url);
    if (cancel) {
      const id = cancel[1];
      const order = [...queues.recibido, ...queues.en_preparacion].find(
        (o) => o.id === id,
      )!;
      queues.recibido = queues.recibido.filter((o) => o.id !== id);
      queues.en_preparacion = queues.en_preparacion.filter((o) => o.id !== id);
      return jsonResponse({ ...order, status: 'cancelado' });
    }
    return jsonResponse({}, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return { queues, posts, fetchMock };
}

const column = (name: string) =>
  screen.getByRole('region', { name: new RegExp(`^${name}`) });
const minutesAgo = (m: number) =>
  new Date(Date.now() - m * 60_000).toISOString();

describe('KitchenView', () => {
  it('muestra las tres columnas con su contador y la tarjeta completa', async () => {
    const a = kitchenOrder({
      number: 1001,
      note: 'Sin azúcar',
      items: [
        {
          productId: 'c1',
          sku: 'CMB',
          name: 'Combo Clásico',
          category: 'combo',
          quantity: 1,
          unitPrice: 6500,
          lineTotal: 6500,
          components: [
            { productId: 'x', sku: 'X', name: 'Capuchino', quantity: 1 },
            { productId: 'y', sku: 'Y', name: 'Pandebono', quantity: 2 },
          ],
        },
      ],
    });
    fakeKitchen({
      recibido: [a],
      en_preparacion: [
        kitchenOrder({ number: 1002, status: 'en_preparacion' }),
      ],
    });
    renderWithQuery(<KitchenView />);

    const porPreparar = await waitFor(() => column('Por preparar'));
    await within(porPreparar).findByText('Pedido #1001');
    expect(within(porPreparar).getByLabelText('1 pedido')).toBeInTheDocument();
    expect(
      within(porPreparar).getByText('1 × Combo Clásico'),
    ).toBeInTheDocument();
    expect(
      within(porPreparar).getByText(/Incluye: 1 × Capuchino, 2 × Pandebono/),
    ).toBeInTheDocument();
    expect(within(porPreparar).getByText('Sin azúcar')).toBeInTheDocument();
    expect(
      within(porPreparar).getByText(/Zona 1 · Edificio A · Piso 2/),
    ).toBeInTheDocument();
    expect(
      within(porPreparar).getByText('Carlos Sarmiento'),
    ).toBeInTheDocument();
    expect(
      within(porPreparar).getByRole('link', { name: '+573005874455' }),
    ).toHaveAttribute('href', 'tel:+573005874455');
    // Sin precios ni datos de pago.
    expect(screen.queryByText(/\$/)).toBeNull();
    expect(screen.queryByText(/4242/)).toBeNull();

    expect(
      await within(column('En preparación')).findByText('Pedido #1002'),
    ).toBeInTheDocument();
    expect(
      within(column('Listos')).getByText(
        'No hay pedidos listos esperando al repartidor.',
      ),
    ).toBeInTheDocument();
  });

  it('un teléfono con forma inesperada se muestra como texto, sin enlace', async () => {
    fakeKitchen({
      recibido: [
        kitchenOrder({
          customer: { name: 'Ana', phone: 'javascript:alert(1)' },
        }),
      ],
    });
    renderWithQuery(<KitchenView />);
    await screen.findByText('Pedido #1001');
    expect(screen.getByText('javascript:alert(1)')).toBeInTheDocument();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('«Listos» es compacto: 10 más antiguos y «Ver los N listos»', async () => {
    const listos = Array.from({ length: 12 }, (_, i) =>
      kitchenOrder({ number: 1001 + i, status: 'listo' }),
    );
    fakeKitchen({ listo: listos });
    const user = userEvent.setup();
    renderWithQuery(<KitchenView />);

    const col = await waitFor(() => column('Listos'));
    await within(col).findByText('Pedido #1001');
    expect(within(col).getAllByRole('article')).toHaveLength(10);
    expect(within(col).queryByText('Pedido #1011')).toBeNull();
    // Compacta: sin botones de acción.
    expect(
      within(col).queryByRole('button', { name: /Empezar|Marcar listo/ }),
    ).toBeNull();

    await user.click(
      within(col).getByRole('button', { name: 'Ver los 12 listos' }),
    );
    expect(within(col).getAllByRole('article')).toHaveLength(12);
    await user.click(within(col).getByRole('button', { name: 'Ver menos' }));
    expect(within(col).getAllByRole('article')).toHaveLength(10);
  });

  it('«Empezar» mueve el pedido a «En preparación», lo anuncia y no se envía dos veces', async () => {
    const { posts } = fakeKitchen({
      recibido: [kitchenOrder({ number: 1001 })],
    });
    renderWithQuery(<KitchenView />);
    const button = await screen.findByRole('button', {
      name: 'Empezar el pedido 1001',
    });
    fireEvent.click(button);
    fireEvent.click(button);

    await within(column('En preparación')).findByText('Pedido #1001');
    expect(posts).toHaveLength(1);
    expect(posts[0]?.url).toMatch(/\/api\/kitchen\/orders\/.+\/start$/);
    expect(
      within(column('Por preparar')).queryByText('Pedido #1001'),
    ).toBeNull();
    await waitFor(() =>
      expect(document.body).toHaveTextContent('Pedido #1001: En preparación'),
    );
    // El foco acompaña a la tarjeta a su nueva columna.
    await waitFor(() =>
      expect(
        within(column('En preparación')).getByRole('article'),
      ).toHaveFocus(),
    );
  });

  it('«Marcar listo» mueve el pedido a «Listos»', async () => {
    fakeKitchen({
      en_preparacion: [
        kitchenOrder({ number: 1001, status: 'en_preparacion' }),
      ],
    });
    renderWithQuery(<KitchenView />);
    fireEvent.click(
      await screen.findByRole('button', {
        name: 'Marcar listo el pedido 1001',
      }),
    );
    await within(column('Listos')).findByText('Pedido #1001');
    expect(
      within(column('En preparación')).queryByText('Pedido #1001'),
    ).toBeNull();
  });

  it('un 409 explica que otro operador ya cambió el pedido', async () => {
    fakeKitchen(
      { recibido: [kitchenOrder({ number: 1001 })] },
      { failAction: 409 },
    );
    renderWithQuery(<KitchenView />);
    fireEvent.click(
      await screen.findByRole('button', { name: 'Empezar el pedido 1001' }),
    );
    expect(
      await screen.findByText(
        'Pedido #1001: Otro operador ya cambió este pedido.',
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(
      screen.queryByText(/Otro operador ya cambió este pedido/),
    ).toBeNull();
  });

  it('cancelar pide un motivo, lo envía y saca el pedido de la cola', async () => {
    const { posts } = fakeKitchen({
      recibido: [kitchenOrder({ number: 1001 })],
    });
    const user = userEvent.setup();
    renderWithQuery(<KitchenView />);
    await user.click(
      await screen.findByRole('button', { name: 'Cancelar el pedido 1001' }),
    );

    expect(
      screen.getByText(/Se reembolsará el pago al cliente/),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Confirmar cancelación' }),
    );
    expect(
      await screen.findByText('Escribe el motivo de la cancelación.'),
    ).toBeInTheDocument();
    expect(posts).toHaveLength(0);

    await user.type(
      screen.getByLabelText(/Motivo de la cancelación del pedido 1001/),
      'Se acabó el café',
    );
    expect(screen.getByText(/16\/200/)).toBeInTheDocument();
    await user.click(
      screen.getByRole('button', { name: 'Confirmar cancelación' }),
    );

    await waitFor(() => expect(screen.queryByText('Pedido #1001')).toBeNull());
    expect(posts).toHaveLength(1);
    expect(posts[0]?.url).toMatch(/\/api\/orders\/.+\/cancel$/);
    expect(posts[0]?.body).toEqual({ reason: 'Se acabó el café' });
  });

  it('«Listos» no tiene botón de cancelar y «Volver» cierra el formulario', async () => {
    fakeKitchen({
      recibido: [kitchenOrder({ number: 1001 })],
      listo: [kitchenOrder({ number: 1002, status: 'listo' })],
    });
    const user = userEvent.setup();
    renderWithQuery(<KitchenView />);
    await user.click(
      await screen.findByRole('button', { name: 'Cancelar el pedido 1001' }),
    );
    await user.click(screen.getByRole('button', { name: 'Volver' }));
    expect(
      screen.getByRole('button', { name: 'Cancelar el pedido 1001' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Cancelar el pedido 1002' }),
    ).toBeNull();
  });

  it('marca la espera larga con texto (5 min en Por preparar, 15 en En preparación)', async () => {
    fakeKitchen({
      recibido: [
        kitchenOrder({
          number: 1001,
          createdAt: minutesAgo(8),
          events: [{ status: 'recibido', at: minutesAgo(8) }],
        }),
        kitchenOrder({
          number: 1002,
          createdAt: minutesAgo(2),
          events: [{ status: 'recibido', at: minutesAgo(2) }],
        }),
      ],
      en_preparacion: [
        kitchenOrder({
          number: 1003,
          status: 'en_preparacion',
          events: [
            { status: 'recibido', at: minutesAgo(30) },
            { status: 'en_preparacion', at: minutesAgo(10) },
          ],
        }),
      ],
    });
    renderWithQuery(<KitchenView />);
    expect(await screen.findByText('Lleva 8 min')).toBeInTheDocument();
    expect(screen.getByText('hace 2 min')).toBeInTheDocument();
    expect(screen.getByText('hace 10 min')).toBeInTheDocument(); // 10 min en preparación: aún no es larga
  });

  it('los botones de columna (pantallas estrechas) indican cuál se ve y el contador', async () => {
    fakeKitchen({ recibido: [kitchenOrder({ number: 1001 })] });
    const user = userEvent.setup();
    renderWithQuery(<KitchenView />);
    const group = screen.getByRole('group', { name: 'Columna que se muestra' });
    await within(group).findByText('1');
    const por = within(group).getByRole('button', { name: /Por preparar/ });
    const listos = within(group).getByRole('button', { name: /Listos/ });
    expect(por).toHaveAttribute('aria-pressed', 'true');
    expect(listos).toHaveAttribute('aria-pressed', 'false');
    await user.click(listos);
    expect(listos).toHaveAttribute('aria-pressed', 'true');
    expect(por).toHaveAttribute('aria-pressed', 'false');
  });

  it('avisa de un pedido nuevo cuando la cola cambia', async () => {
    const { queues } = fakeKitchen({
      recibido: [kitchenOrder({ number: 1001 })],
    });
    const { client } = renderWithQuery(<KitchenView />);
    await screen.findByText('Pedido #1001');
    queues.recibido = [...queues.recibido, kitchenOrder({ number: 1002 })];
    await act(() => client.invalidateQueries({ queryKey: ['kitchen'] }));
    await waitFor(() =>
      expect(document.body).toHaveTextContent('Nuevo pedido #1002'),
    );
  });

  it('un error de carga ofrece «Reintentar» en la columna', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => jsonResponse({ statusCode: 500, message: 'x' }, 500)),
    );
    renderWithQuery(<KitchenView />);
    const col = await waitFor(() => column('Por preparar'));
    expect(
      await within(col).findByRole(
        'button',
        { name: 'Reintentar' },
        { timeout: 4000 },
      ),
    ).toBeInTheDocument();
  });
});
