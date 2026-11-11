import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  backRound,
  dispatchOrder,
  fakeDispatchBack,
} from '../../../tests/utils/dispatch';
import { renderWithQuery } from '../../../tests/utils/render';
import { RoundsView } from './rounds-view';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const inRoute = (n: number, over = {}) =>
  dispatchOrder(n, 'z1', {
    status: 'en_camino',
    customer: { name: 'Ana Pérez', phone: '+573001112233' },
    delivery: { deliveryNote: 'Entregar en recepción' } as never,
    ...over,
  });

const card = (n: number) =>
  screen.getByRole('article', { name: `Pedido #${String(n)}` });

describe('RoundsView', () => {
  it('sin rondas ofrece ir a la cola', async () => {
    fakeDispatchBack([]);
    renderWithQuery(<RoundsView />);
    expect(
      await screen.findByText('No tienes rondas activas.'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Ir a la cola de despacho' }),
    ).toHaveAttribute('href', '/repartidor/cola');
  });

  it('muestra la ronda con la llegada estimada, el avance y los datos del pedido', async () => {
    fakeDispatchBack(
      [],
      [backRound({ orders: [inRoute(1001), inRoute(1002)] })],
    );
    renderWithQuery(<RoundsView />);
    const round = await screen.findByRole('region', { name: /Ronda · Zona 1/ });
    expect(round).toHaveTextContent('Llegada estimada 1:25 p. m.');
    expect(round).toHaveTextContent('0 de 2 entregados');
    const c = card(1001);
    expect(c).toHaveTextContent('Zona 1 · Edificio A · Piso 2');
    expect(c).toHaveTextContent('Entregar en recepción');
    expect(c).toHaveTextContent('2 × Capuchino (caliente)');
    expect(within(c).getByText('Ana Pérez')).toBeInTheDocument();
    expect(
      within(c).getByRole('link', { name: /Llamar \+573001112233/ }),
    ).toHaveAttribute('href', 'tel:+573001112233');
    expect(within(c).getByRole('link', { name: /WhatsApp/ })).toHaveAttribute(
      'href',
      'https://wa.me/573001112233',
    );
    expect(document.body.textContent).not.toMatch(/\$|9\.000|4242/);
  });

  it('marca la ronda vencida con texto cuando pasó la llegada estimada', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-11-10T18:30:00.000Z'));
    fakeDispatchBack([], [backRound({ orders: [inRoute(1001)] })]);
    renderWithQuery(<RoundsView />);
    expect(await screen.findByText('Vencida hace 5 min')).toBeInTheDocument();
  });

  it('«Entregado» pide confirmación, entrega y deja el pedido atenuado con su resultado', async () => {
    const back = fakeDispatchBack(
      [],
      [backRound({ orders: [inRoute(1001), inRoute(1002)] })],
    );
    const user = userEvent.setup();
    renderWithQuery(<RoundsView />);
    await screen.findByText('Pedido #1001');
    await user.click(screen.getByRole('button', { name: 'Entregado #1001' }));
    expect(
      screen.getByText('¿Entregaste el pedido #1001?'),
    ).toBeInTheDocument();
    expect(back.posts()).toHaveLength(0);
    await user.click(
      screen.getByRole('button', { name: 'Sí, entregado el pedido 1001' }),
    );
    await waitFor(() => expect(card(1001)).toHaveTextContent('Entregado'));
    expect(back.posts()[0]?.url).toBe(
      `/api/dispatch/orders/${inRoute(1001).id}/deliver`,
    );
    expect(
      within(card(1001)).queryByRole('button', { name: /Entregado #/ }),
    ).toBeNull();
    expect(screen.getByRole('region', { name: /Ronda/ })).toHaveTextContent(
      '1 de 2 entregados',
    );
  });

  it('«Volver» cancela la confirmación sin enviar nada', async () => {
    const back = fakeDispatchBack([], [backRound({ orders: [inRoute(1001)] })]);
    const user = userEvent.setup();
    renderWithQuery(<RoundsView />);
    await screen.findByText('Pedido #1001');
    await user.click(screen.getByRole('button', { name: 'Entregado #1001' }));
    await user.click(screen.getByRole('button', { name: 'Volver' }));
    expect(
      screen.getByRole('button', { name: 'Entregado #1001' }),
    ).toBeInTheDocument();
    expect(back.posts()).toHaveLength(0);
  });

  it('«No entregado» exige motivo, lo envía recortado y al cerrar el último anuncia el resumen', async () => {
    const back = fakeDispatchBack([], [backRound({ orders: [inRoute(1001)] })]);
    const user = userEvent.setup();
    renderWithQuery(<RoundsView />);
    await screen.findByText('Pedido #1001');
    await user.click(
      screen.getByRole('button', { name: 'No entregado #1001' }),
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Confirmar no entrega del pedido 1001',
      }),
    );
    expect(
      screen.getByText('Escribe el motivo por el que no se entregó.'),
    ).toBeInTheDocument();
    expect(back.posts()).toHaveLength(0);
    await user.click(
      screen.getByRole('button', { name: 'No contestó el teléfono' }),
    );
    await user.click(
      screen.getByRole('button', {
        name: 'Confirmar no entrega del pedido 1001',
      }),
    );
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent(
        'Ronda terminada: 0 entregados, 1 no entregado',
      ),
    );
    expect(back.posts()[0]?.body).toEqual({
      reason: 'No contestó el teléfono',
    });
    expect(screen.getByText('No tienes rondas activas.')).toBeInTheDocument();
  });

  it('doble clic en «Sí, entregado» envía una sola petición', async () => {
    const back = fakeDispatchBack(
      [],
      [backRound({ orders: [inRoute(1001), inRoute(1002)] })],
    );
    const user = userEvent.setup();
    renderWithQuery(<RoundsView />);
    await screen.findByText('Pedido #1001');
    await user.click(screen.getByRole('button', { name: 'Entregado #1001' }));
    await user.dblClick(
      screen.getByRole('button', { name: 'Sí, entregado el pedido 1001' }),
    );
    await waitFor(() => expect(card(1001)).toHaveTextContent('Entregado'));
    expect(back.posts()).toHaveLength(1);
  });

  it('un 409 se explica en un aviso de pantalla y se cierra con «Entendido»', async () => {
    fakeDispatchBack(
      [],
      [backRound({ orders: [inRoute(1001), inRoute(1002)] })],
      {
        failClose: { 1001: 409 },
      },
    );
    const user = userEvent.setup();
    renderWithQuery(<RoundsView />);
    await screen.findByText('Pedido #1001');
    await user.click(screen.getByRole('button', { name: 'Entregado #1001' }));
    await user.click(
      screen.getByRole('button', { name: 'Sí, entregado el pedido 1001' }),
    );
    expect(
      await screen.findByText(/Pedido #1001: Este pedido ya no está en camino/),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByText(/ya no está en camino/)).toBeNull();
  });

  it('un corte de red no se reintenta solo: consulta la ronda y ofrece «Reintentar»', async () => {
    const back = fakeDispatchBack(
      [],
      [backRound({ orders: [inRoute(1001), inRoute(1002)] })],
      {
        failClose: { 1001: 'network' },
      },
    );
    const user = userEvent.setup();
    renderWithQuery(<RoundsView />);
    await screen.findByText('Pedido #1001');
    await user.click(screen.getByRole('button', { name: 'Entregado #1001' }));
    await user.click(
      screen.getByRole('button', { name: 'Sí, entregado el pedido 1001' }),
    );
    expect(
      await screen.findByText(
        /El cambio no se registró: puedes intentarlo de nuevo/,
      ),
    ).toBeInTheDocument();
    expect(back.posts()).toHaveLength(1);
    expect(
      screen.getByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument();
  });

  it('un cambio externo de la ronda aparece al refrescar la consulta', async () => {
    const back = fakeDispatchBack(
      [],
      [backRound({ orders: [inRoute(1001), inRoute(1002)] })],
    );
    const { client } = renderWithQuery(<RoundsView />);
    await screen.findByText('Pedido #1001');
    back.rounds[0]!.orders[0]!.status = 'entregado';
    await act(() => client.invalidateQueries({ queryKey: ['dispatch'] }));
    await waitFor(() => expect(card(1001)).toHaveTextContent('Entregado'));
  });
});
