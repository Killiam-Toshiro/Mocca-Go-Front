import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  backRound,
  dispatchOrder,
  fakeDispatchBack,
} from '../../../tests/utils/dispatch';
import { renderWithQuery } from '../../../tests/utils/render';
import { QueueView } from './queue-view';

const push = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ push }) }));
afterEach(() => {
  vi.unstubAllGlobals();
  push.mockReset();
});

const zone = (name: string) =>
  screen.getByRole('region', { name: new RegExp(name) });
const bar = () => screen.getByRole('button', { name: /Salir con/ });

describe('QueueView', () => {
  it('muestra una tarjeta por zona con la sugerida marcada y los datos del pedido, sin precios', async () => {
    fakeDispatchBack([
      dispatchOrder(1002, 'z2'),
      dispatchOrder(1001, 'z1', {
        delivery: { deliveryNote: 'Junto a la caja' } as never,
      }),
    ]);
    renderWithQuery(<QueueView />);
    const z1 = await screen.findByRole('region', { name: /Zona 1/ });
    expect(z1).toHaveTextContent('Sugerida: lleva el pedido más antiguo');
    expect(z1).toHaveTextContent('Pedido #1001');
    expect(z1).toHaveTextContent('Edificio A · Piso 2');
    expect(z1).toHaveTextContent('Junto a la caja');
    expect(z1).toHaveTextContent('1 pedido listo');
    expect(zone('Zona 2')).not.toHaveTextContent('Sugerida');
    expect(document.body.textContent).not.toMatch(/\$|9\.000|4242/);
  });

  it('con la cola vacía dice que no hay pedidos y no deja salir', async () => {
    fakeDispatchBack([]);
    renderWithQuery(<QueueView />);
    expect(
      await screen.findByText('No hay pedidos listos para repartir.'),
    ).toBeInTheDocument();
    expect(bar()).toBeDisabled();
  });

  it('«Salir con la sugerencia» envía {} y lleva a «Mis rondas»', async () => {
    const back = fakeDispatchBack([dispatchOrder(1001)]);
    const user = userEvent.setup();
    renderWithQuery(<QueueView />);
    await screen.findByText('Pedido #1001');
    await user.click(
      screen.getByRole('button', { name: 'Salir con la sugerencia' }),
    );
    await waitFor(() =>
      expect(push).toHaveBeenCalledWith('/repartidor/rondas'),
    );
    expect(back.posts()).toHaveLength(1);
    expect(back.posts()[0]?.body).toEqual({});
  });

  it('elegir pedidos envía { orderIds }, cuenta hasta 5 y bloquea otras zonas', async () => {
    const orders = [
      dispatchOrder(1001),
      dispatchOrder(1002),
      dispatchOrder(1003, 'z2'),
    ];
    const back = fakeDispatchBack(orders);
    const user = userEvent.setup();
    renderWithQuery(<QueueView />);
    await screen.findByText('Pedido #1001');
    await user.click(
      screen.getByRole('checkbox', { name: 'Elegir pedido #1001' }),
    );
    expect(screen.getByText('1 de 5 pedidos elegidos')).toBeInTheDocument();
    const other = screen.getByRole('checkbox', { name: 'Elegir pedido #1003' });
    expect(other).toBeDisabled();
    expect(
      within(zone('Zona 2')).getByText('Una ronda es de una sola zona'),
    ).toBeInTheDocument();
    await user.click(
      screen.getByRole('checkbox', { name: 'Elegir pedido #1002' }),
    );
    await user.click(
      screen.getByRole('button', { name: 'Salir con 2 pedidos' }),
    );
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(back.posts()[0]?.body).toEqual({
      orderIds: [orders[0]!.id, orders[1]!.id],
    });
  });

  it('con 2 rondas activas deshabilita salir y lo explica', async () => {
    fakeDispatchBack(
      [dispatchOrder(1001)],
      [
        backRound({
          id: 'r1',
          orders: [dispatchOrder(1, 'z1', { status: 'en_camino' })],
        }),
        backRound({
          id: 'r2',
          orders: [dispatchOrder(2, 'z1', { status: 'en_camino' })],
        }),
      ],
    );
    renderWithQuery(<QueueView />);
    await screen.findByText('Pedido #1001');
    await screen.findByText(/Ya tienes 2 rondas activas/);
    expect(
      screen.getByRole('button', { name: 'Salir con la sugerencia' }),
    ).toBeDisabled();
  });

  it('un 409 del back se explica con un aviso y «Entendido» lo cierra', async () => {
    const back = fakeDispatchBack([dispatchOrder(1001)], [], {
      failCreate: 409,
      createMessage:
        'Tu perfil de repartidor no tiene el teléfono; pídele al administrador que lo complete.',
    });
    const user = userEvent.setup();
    renderWithQuery(<QueueView />);
    await screen.findByText('Pedido #1001');
    await user.click(
      screen.getByRole('button', { name: 'Salir con la sugerencia' }),
    );
    expect(
      await screen.findByText(/Falta tu nombre o teléfono en el perfil/),
    ).toBeInTheDocument();
    expect(push).not.toHaveBeenCalled();
    expect(back.posts()).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByText(/Falta tu nombre/)).toBeNull();
  });

  it('doble clic en «Salir» envía una sola petición', async () => {
    const back = fakeDispatchBack([dispatchOrder(1001)]);
    const user = userEvent.setup();
    renderWithQuery(<QueueView />);
    await screen.findByText('Pedido #1001');
    await user.dblClick(
      screen.getByRole('button', { name: 'Salir con la sugerencia' }),
    );
    await waitFor(() => expect(push).toHaveBeenCalled());
    expect(back.posts()).toHaveLength(1);
  });

  it('si otro repartidor toma un pedido elegido, se quita de la elección y se avisa', async () => {
    const orders = [dispatchOrder(1001), dispatchOrder(1002)];
    const back = fakeDispatchBack(orders);
    const user = userEvent.setup();
    const { client } = renderWithQuery(<QueueView />);
    await screen.findByText('Pedido #1001');
    await user.click(
      screen.getByRole('checkbox', { name: 'Elegir pedido #1001' }),
    );
    await user.click(
      screen.getByRole('checkbox', { name: 'Elegir pedido #1002' }),
    );
    back.queue.splice(0, 1); // lo toma otro repartidor
    await client.invalidateQueries({ queryKey: ['dispatch'] });
    expect(
      await screen.findByText(
        'El pedido #1001 ya no está listo y se quitó de tu elección.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Salir con 1 pedido' }),
    ).toBeInTheDocument();
  });
});
