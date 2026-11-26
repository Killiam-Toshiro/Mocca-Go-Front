import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backProduct } from '../../../tests/utils/inventory';
import { fakeInventoryBack } from '../../../tests/utils/inventory-back';
import { renderWithQuery } from '../../../tests/utils/render';
import { InventoryView } from './inventory-view';

afterEach(() => vi.unstubAllGlobals());

const catalog = () => [
  backProduct({ id: 'a', name: 'Capuchino', sku: 'CAF-CAPU', stock: 20 }),
  backProduct({ id: 'b', name: 'Pandebono', sku: 'PAN-1', stock: 10 }),
  backProduct({ id: 'c', name: 'Combo Clásico', category: 'combo', stock: 7 }),
  backProduct({ id: 'd', name: 'Mocca', active: false, available: false }),
];

async function open(user: ReturnType<typeof userEvent.setup>) {
  renderWithQuery(<InventoryView />);
  await user.click(
    await screen.findByRole('button', { name: 'Preparar el día' }),
  );
  await screen.findByLabelText('Para hoy: Capuchino');
}

const posts = (back: ReturnType<typeof fakeInventoryBack>) =>
  back.calls.filter((c) => c.method === 'POST');

describe('PrepareDay', () => {
  it('lista solo productos simples y activos', async () => {
    fakeInventoryBack(catalog());
    await open(userEvent.setup());
    expect(screen.getByLabelText('Para hoy: Pandebono')).toBeInTheDocument();
    expect(screen.queryByLabelText('Para hoy: Combo Clásico')).toBeNull();
    expect(screen.queryByLabelText('Para hoy: Mocca')).toBeNull();
  });

  it('muestra la diferencia, resume y aplica un movimiento por producto', async () => {
    const back = fakeInventoryBack(catalog());
    const user = userEvent.setup();
    await open(user);
    await user.type(screen.getByLabelText('Para hoy: Capuchino'), '50');
    await user.type(screen.getByLabelText('Para hoy: Pandebono'), '4');
    expect(
      screen.getByLabelText('Diferencia de Capuchino: +30'),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText('Diferencia de Pandebono: −6'),
    ).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Revisar cambios' }));
    const confirm = screen.getByRole('group', { name: 'Confirmar cambios' });
    expect(confirm).toHaveTextContent('2 productos: 1 sube, 1 baja');
    await user.click(
      within(confirm).getByRole('button', { name: 'Aplicar 2 cambios' }),
    );

    expect(
      await screen.findByText('2 aplicados, 0 con error, 0 por revisar.'),
    ).toBeInTheDocument();
    expect(posts(back).map((c) => c.body)).toEqual([
      { productId: 'a', type: 'IN', quantity: 30, reason: 'Preparar el día' },
      { productId: 'b', type: 'OUT', quantity: 6, reason: 'Preparar el día' },
    ]);
    // Los campos aplicados quedan vacíos.
    expect(screen.getByLabelText('Para hoy: Capuchino')).toHaveValue('');
  });

  it('un error de formato bloquea «Revisar cambios»', async () => {
    fakeInventoryBack(catalog());
    const user = userEvent.setup();
    await open(user);
    await user.type(screen.getByLabelText('Para hoy: Capuchino'), '1.5');
    expect(screen.getByText(/número entero/)).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Revisar cambios' }),
    ).toBeDisabled();
  });

  it('un fallo parcial deja el campo de la fila fallida y aplica las demás', async () => {
    const back = fakeInventoryBack(catalog(), { failMovementFor: { a: 409 } });
    const user = userEvent.setup();
    await open(user);
    await user.type(screen.getByLabelText('Para hoy: Capuchino'), '50');
    await user.type(screen.getByLabelText('Para hoy: Pandebono'), '30');
    await user.click(screen.getByRole('button', { name: 'Revisar cambios' }));
    await user.click(screen.getByRole('button', { name: 'Aplicar 2 cambios' }));

    expect(
      await screen.findByText('1 aplicados, 1 con error, 0 por revisar.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Para hoy: Capuchino')).toHaveValue('50');
    expect(screen.getByLabelText('Para hoy: Pandebono')).toHaveValue('');
    expect(posts(back)).toHaveLength(2);
  });

  it('un corte de red deja la fila por revisar y bloqueada hasta «Ya lo revisé»', async () => {
    const back = fakeInventoryBack(catalog(), {
      failMovementFor: { a: 'network' },
    });
    const user = userEvent.setup();
    await open(user);
    await user.type(screen.getByLabelText('Para hoy: Capuchino'), '50');
    await user.click(screen.getByRole('button', { name: 'Revisar cambios' }));
    await user.click(screen.getByRole('button', { name: 'Aplicar 1 cambio' }));

    expect(
      await screen.findByText(/No sabemos si se registró/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Para hoy: Capuchino')).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Ver historial' }),
    ).toBeInTheDocument();
    expect(posts(back)).toHaveLength(1);

    await user.click(
      screen.getByRole('button', {
        name: 'Ya revisé el historial de Capuchino',
      }),
    );
    await waitFor(() =>
      expect(screen.getByLabelText('Para hoy: Capuchino')).toBeEnabled(),
    );
    expect(screen.queryByText(/No sabemos si se registró/)).toBeNull();
  });

  it('un doble clic en «Aplicar» envía un solo movimiento por fila', async () => {
    const back = fakeInventoryBack(catalog());
    const user = userEvent.setup();
    await open(user);
    await user.type(screen.getByLabelText('Para hoy: Capuchino'), '50');
    await user.click(screen.getByRole('button', { name: 'Revisar cambios' }));
    await user.dblClick(
      screen.getByRole('button', { name: 'Aplicar 1 cambio' }),
    );
    await screen.findByText(/1 aplicados/);
    expect(posts(back)).toHaveLength(1);
  });

  it('los valores escritos sobreviven al cambiar de sección', async () => {
    fakeInventoryBack(catalog());
    const user = userEvent.setup();
    await open(user);
    await user.type(screen.getByLabelText('Para hoy: Capuchino'), '50');
    await user.click(screen.getByRole('button', { name: 'Historial' }));
    await user.click(screen.getByRole('button', { name: 'Preparar el día' }));
    expect(await screen.findByLabelText('Para hoy: Capuchino')).toHaveValue(
      '50',
    );
  });
});
