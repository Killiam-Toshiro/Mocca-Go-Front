import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backRound, dispatchOrder } from '../../../tests/utils/dispatch';
import { jsonResponse, renderWithQuery } from '../../../tests/utils/render';
import { StaffRoundDetail } from './staff-round-detail';
import { StaffRoundsView } from './staff-rounds-view';

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const page = (data: unknown[]) => ({
  page: 1,
  limit: 20,
  total: data.length,
  totalPages: 1,
  data,
});

describe('StaffRoundsView', () => {
  it('marca «Atrasada N min» solo la ronda vencida con pedidos en camino', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-11-10T18:40:00.000Z'));
    const late = backRound({
      id: 'r-late',
      orders: [dispatchOrder(1001, 'z1', { status: 'en_camino' })],
    });
    const done = backRound({
      id: 'r-done',
      status: 'finalizada',
      orders: [dispatchOrder(1002, 'z2', { status: 'entregado' })],
    });
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () => jsonResponse(page([late, done]))),
    );
    renderWithQuery(<StaffRoundsView base="/admin" />);
    expect(await screen.findByText('Atrasada 15 min')).toBeInTheDocument();
    expect(screen.getAllByText(/Atrasada/)).toHaveLength(1);
    expect(screen.getByText('Finalizada')).toBeInTheDocument();
    expect(screen.getAllByRole('link')[0]).toHaveAttribute(
      'href',
      '/admin/rondas/r-late',
    );
  });

  it('el filtro de estado pide solo esas rondas', async () => {
    const f = vi.fn<typeof fetch>(async () => jsonResponse(page([])));
    vi.stubGlobal('fetch', f);
    renderWithQuery(<StaffRoundsView base="/operador" />);
    await screen.findByText('No hay rondas con este estado.');
    await userEvent.selectOptions(screen.getByLabelText('Estado'), 'activa');
    await waitFor(() =>
      expect(f.mock.calls.at(-1)?.[0]).toBe(
        '/api/dispatch/rounds?page=1&limit=20&status=activa',
      ),
    );
  });
});

describe('StaffRoundDetail', () => {
  it('muestra repartidor con teléfono y los pedidos enlazados a su detalle', async () => {
    const order = dispatchOrder(1010, 'z1', { status: 'en_camino' });
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        jsonResponse(backRound({ id: 'r1', orders: [order] })),
      ),
    );
    renderWithQuery(<StaffRoundDetail id="r1" base="/operador" />);
    expect(
      await screen.findByRole('heading', { name: 'Ronda · Zona 1' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Carlos Gómez')).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Llamar +573001234500' }),
    ).toHaveAttribute('href', 'tel:+573001234500');
    expect(screen.getByRole('link', { name: 'Pedido #1010' })).toHaveAttribute(
      'href',
      `/operador/pedidos/${order.id}`,
    );
  });

  it('una ronda inexistente muestra el aviso', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(async () =>
        jsonResponse({ statusCode: 404, message: 'Ronda no encontrada.' }, 404),
      ),
    );
    renderWithQuery(<StaffRoundDetail id="x" base="/admin" />);
    expect(
      await screen.findByText('No encontramos esta ronda.'),
    ).toBeInTheDocument();
  });
});
