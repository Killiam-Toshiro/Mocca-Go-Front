import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backProduct } from '../../../tests/utils/inventory';
import { fakeInventoryBack } from '../../../tests/utils/inventory-back';
import { renderWithQuery } from '../../../tests/utils/render';
import { ProductsView } from './products-view';

afterEach(() => vi.unstubAllGlobals());

const capu = () =>
  backProduct({ id: 'p-capu', name: 'Capuchino', sku: 'CAF-CAPU' });
const chai = () =>
  backProduct({
    id: 'p-chai',
    name: 'Té chai',
    sku: 'BEB-CHAI',
    category: 'bebida',
  });

describe('ProductsView', () => {
  it('lista el catálogo con estado en palabras y saldo, sin costo ni margen', async () => {
    fakeInventoryBack([
      capu(),
      backProduct({
        id: 'p2',
        name: 'Brownie',
        soldOut: true,
        available: false,
      }),
      backProduct({ id: 'p3', name: 'Latte', stock: 0, available: false }),
      backProduct({ id: 'p4', name: 'Mocca', active: false, available: false }),
      backProduct({
        id: 'p5',
        name: 'Combo Clásico',
        category: 'combo',
        stock: 0,
        available: false,
      }),
    ]);
    renderWithQuery(<ProductsView />);
    expect(
      await screen.findByRole('heading', { name: 'Capuchino' }),
    ).toBeInTheDocument();
    for (const label of [
      'Disponible',
      'Agotado',
      'Sin saldo',
      'Inactivo',
      'Falta saldo de un componente',
    ])
      expect(screen.getByText(label)).toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/1600|35[.,]6|costo|margen/i);
    expect(
      screen.getByText('Lo gestiona el administrador'),
    ).toBeInTheDocument();
  });

  it('busca por nombre o SKU, filtra por categoría y por agotados', async () => {
    fakeInventoryBack([
      capu(),
      chai(),
      backProduct({
        id: 'p3',
        name: 'Brownie',
        soldOut: true,
        available: false,
      }),
    ]);
    const user = userEvent.setup();
    renderWithQuery(<ProductsView />);
    await screen.findByRole('heading', { name: 'Capuchino' });

    await user.type(screen.getByLabelText('Buscar producto'), 'te CHAI');
    expect(screen.queryByRole('heading', { name: 'Capuchino' })).toBeNull();
    expect(
      screen.getByRole('heading', { name: 'Té chai' }),
    ).toBeInTheDocument();
    await user.clear(screen.getByLabelText('Buscar producto'));

    await user.selectOptions(screen.getByLabelText('Categoría'), 'bebida');
    expect(screen.queryByRole('heading', { name: 'Capuchino' })).toBeNull();
    await user.selectOptions(screen.getByLabelText('Categoría'), 'todas');

    await user.selectOptions(screen.getByLabelText('Estado'), 'agotados');
    expect(
      screen.getByRole('heading', { name: 'Brownie' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Capuchino' })).toBeNull();

    await user.type(screen.getByLabelText('Buscar producto'), 'zzz');
    expect(
      screen.getByText('Ningún producto coincide con los filtros.'),
    ).toBeInTheDocument();
  });

  it('«Marcar agotado» llama a PATCH, cambia la fila y lo anuncia; «Volver a vender» lo revierte', async () => {
    const back = fakeInventoryBack([capu()]);
    const user = userEvent.setup();
    renderWithQuery(<ProductsView />);
    await user.click(
      await screen.findByRole('button', { name: 'Marcar agotado Capuchino' }),
    );
    const patch = back.calls.find((c) => c.method === 'PATCH')!;
    expect(patch.url).toBe('/api/products/p-capu/sold-out');
    expect(patch.body).toEqual({ soldOut: true });
    expect(
      await screen.findByText('Capuchino ya no se puede pedir.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Agotado')).toBeInTheDocument();

    await user.click(
      screen.getByRole('button', { name: 'Volver a vender Capuchino' }),
    );
    expect(
      await screen.findByText('Capuchino vuelve a venderse.'),
    ).toBeInTheDocument();
    expect(back.calls.filter((c) => c.method === 'PATCH')[1]?.body).toEqual({
      soldOut: false,
    });
  });

  it('un doble clic envía una sola petición', async () => {
    const back = fakeInventoryBack([capu()]);
    renderWithQuery(<ProductsView />);
    const button = await screen.findByRole('button', {
      name: 'Marcar agotado Capuchino',
    });
    fireEvent.click(button);
    fireEvent.click(button);
    await screen.findByText('Capuchino ya no se puede pedir.');
    expect(back.calls.filter((c) => c.method === 'PATCH')).toHaveLength(1);
  });

  it('un 404 se avisa en la pantalla (no en la fila) con «Entendido»', async () => {
    fakeInventoryBack([capu()], { failSoldOut: 404 });
    const user = userEvent.setup();
    renderWithQuery(<ProductsView />);
    await user.click(
      await screen.findByRole('button', { name: 'Marcar agotado Capuchino' }),
    );
    expect(
      await screen.findByText('Capuchino: Este producto ya no existe.'),
    ).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByText(/ya no existe/)).toBeNull();
  });

  it('un corte de red muestra «Reintentar» dentro de la fila', async () => {
    fakeInventoryBack([capu()], { failSoldOut: 'network' });
    const user = userEvent.setup();
    renderWithQuery(<ProductsView />);
    await user.click(
      await screen.findByRole('button', { name: 'Marcar agotado Capuchino' }),
    );
    const row = (
      await screen.findByRole('heading', { name: 'Capuchino' })
    ).closest('li')!;
    expect(
      await within(row).findByRole('button', { name: 'Reintentar' }),
    ).toBeInTheDocument();
    expect(
      within(row).getByText('No pudimos conectar con el servidor.'),
    ).toBeInTheDocument();
  });

  it('avisa si el catálogo trae más de 100 productos y muestra «Actualizado»', async () => {
    const back = fakeInventoryBack([capu()]);
    void back;
    renderWithQuery(<ProductsView />);
    await screen.findByRole('heading', { name: 'Capuchino' });
    await waitFor(() =>
      expect(screen.getByText(/Actualizado/)).toBeInTheDocument(),
    );
    expect(
      screen.getByRole('button', { name: 'Actualizar la lista' }),
    ).toBeInTheDocument();
  });
});
