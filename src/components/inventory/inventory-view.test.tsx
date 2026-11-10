import { fireEvent, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { backMovement, backProduct } from '../../../tests/utils/inventory';
import { fakeInventoryBack } from '../../../tests/utils/inventory-back';
import { renderWithQuery } from '../../../tests/utils/render';
import { InventoryView } from './inventory-view';

afterEach(() => vi.unstubAllGlobals());

const capu = () =>
  backProduct({ id: 'p-capu', name: 'Capuchino', sku: 'CAF-CAPU', stock: 20 });
const combo = () =>
  backProduct({
    id: 'p-combo',
    name: 'Combo Clásico',
    category: 'combo',
    stock: 7,
  });

async function openForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(
    await screen.findByRole('button', {
      name: 'Registrar movimiento de Capuchino',
    }),
  );
  return screen.getByRole('form', {
    name: 'Registrar movimiento de Capuchino',
  });
}

describe('InventoryView — saldos', () => {
  it('muestra el saldo; los combos son solo lectura y los inactivos no admiten movimientos', async () => {
    fakeInventoryBack([
      capu(),
      combo(),
      backProduct({ id: 'p3', name: 'Mocca', active: false, available: false }),
    ]);
    renderWithQuery(<InventoryView />);
    expect(
      await screen.findByRole('button', {
        name: 'Registrar movimiento de Capuchino',
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Se calcula con sus componentes'),
    ).toBeInTheDocument();
    expect(screen.getByText('Inactivo: sin movimientos')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {
        name: 'Registrar movimiento de Combo Clásico',
      }),
    ).toBeNull();
  });

  it('registra una entrada con el cuerpo exacto, actualiza el saldo y devuelve el foco', async () => {
    const back = fakeInventoryBack([capu()]);
    const user = userEvent.setup();
    renderWithQuery(<InventoryView />);
    const form = await openForm(user);
    await user.type(within(form).getByLabelText('Cantidad'), '10');
    expect(within(form).getByText(/Quedaría en:/)).toHaveTextContent('30');
    await user.type(
      within(form).getByLabelText('Motivo'),
      'Compra a proveedor',
    );
    await user.click(
      within(form).getByRole('button', { name: 'Registrar producción' }),
    );

    expect(
      await screen.findByText(
        'Producción registrada: Capuchino queda con 30 disponibles.',
      ),
    ).toBeInTheDocument();
    const post = back.calls.find((c) => c.method === 'POST')!;
    expect(post.url).toBe('/api/movements');
    expect(post.body).toEqual({
      productId: 'p-capu',
      type: 'IN',
      quantity: 10,
      reason: 'Compra a proveedor',
    });
    expect(screen.queryByRole('form')).toBeNull();
    const row = screen
      .getByRole('heading', { name: 'Capuchino' })
      .closest('li')!;
    expect(within(row).getByText('30')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Registrar movimiento de Capuchino' }),
    ).toHaveFocus();
  });

  it('valida cantidad y motivo con mensajes y no envía nada', async () => {
    const back = fakeInventoryBack([capu()]);
    const user = userEvent.setup();
    renderWithQuery(<InventoryView />);
    const form = await openForm(user);
    await user.click(
      within(form).getByRole('button', { name: 'Registrar producción' }),
    );
    expect(within(form).getByText('Escribe la cantidad.')).toBeInTheDocument();
    expect(
      within(form).getByText('Escribe el motivo del movimiento.'),
    ).toBeInTheDocument();
    expect(within(form).getByLabelText('Cantidad')).toBeInvalid();
    await user.type(within(form).getByLabelText('Cantidad'), '1.5');
    expect(
      within(form).getByText(
        'La cantidad debe ser un número entero mayor que 0.',
      ),
    ).toBeInTheDocument();
    expect(back.calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('una salida mayor al saldo se bloquea con el saldo conocido', async () => {
    const back = fakeInventoryBack([capu()]);
    const user = userEvent.setup();
    renderWithQuery(<InventoryView />);
    const form = await openForm(user);
    await user.click(within(form).getByLabelText('Merma o salida'));
    await user.type(within(form).getByLabelText('Cantidad'), '25');
    await user.type(within(form).getByLabelText('Motivo'), 'Merma');
    await user.click(
      within(form).getByRole('button', { name: 'Registrar salida' }),
    );
    expect(
      within(form).getByText('Hay 20; no puedes sacar 25.'),
    ).toBeInTheDocument();
    expect(back.calls.some((c) => c.method === 'POST')).toBe(false);
  });

  it('un doble clic en «Registrar» envía un solo movimiento', async () => {
    const back = fakeInventoryBack([capu()]);
    const user = userEvent.setup();
    renderWithQuery(<InventoryView />);
    const form = await openForm(user);
    await user.type(within(form).getByLabelText('Cantidad'), '5');
    await user.type(within(form).getByLabelText('Motivo'), 'Compra');
    const submit = within(form).getByRole('button', {
      name: 'Registrar producción',
    });
    fireEvent.click(submit);
    fireEvent.click(submit);
    await screen.findByText(/Producción registrada/);
    expect(back.calls.filter((c) => c.method === 'POST')).toHaveLength(1);
  });

  it('un 409 se explica y conserva lo escrito', async () => {
    fakeInventoryBack([capu()], { failMovement: 409 });
    const user = userEvent.setup();
    renderWithQuery(<InventoryView />);
    const form = await openForm(user);
    await user.type(within(form).getByLabelText('Cantidad'), '5');
    await user.type(within(form).getByLabelText('Motivo'), 'Compra');
    await user.click(
      within(form).getByRole('button', { name: 'Registrar producción' }),
    );
    expect(
      await within(form).findByText('Saldo insuficiente: hay 3'),
    ).toBeInTheDocument();
    expect(within(form).getByLabelText('Cantidad')).toHaveValue('5');
    expect(within(form).getByLabelText('Motivo')).toHaveValue('Compra');
    expect(
      within(form).getByRole('button', { name: 'Registrar producción' }),
    ).toBeEnabled();
  });

  it('un corte de red no se reintenta: avisa que se revise el historial y bloquea el envío', async () => {
    const back = fakeInventoryBack([capu()], { failMovement: 'network' });
    const user = userEvent.setup();
    renderWithQuery(<InventoryView />);
    const form = await openForm(user);
    await user.type(within(form).getByLabelText('Cantidad'), '5');
    await user.type(within(form).getByLabelText('Motivo'), 'Compra');
    await user.click(
      within(form).getByRole('button', { name: 'Registrar producción' }),
    );
    expect(
      await within(form).findByText(
        /No sabemos si se registró: revisa el historial/,
      ),
    ).toBeInTheDocument();
    expect(
      within(form).getByRole('button', { name: 'Registrar producción' }),
    ).toBeDisabled();
    expect(
      within(form).queryByRole('button', { name: /Reintentar/ }),
    ).toBeNull();
    expect(back.calls.filter((c) => c.method === 'POST')).toHaveLength(1);

    await user.click(
      within(form).getByRole('button', { name: 'Ver historial' }),
    );
    expect(await screen.findByLabelText('Producto')).toBeInTheDocument();
  });

  it('un 404 cierra el formulario y avisa en la pantalla', async () => {
    fakeInventoryBack([capu()], { failMovement: 404 });
    const user = userEvent.setup();
    renderWithQuery(<InventoryView />);
    const form = await openForm(user);
    await user.type(within(form).getByLabelText('Cantidad'), '5');
    await user.type(within(form).getByLabelText('Motivo'), 'Compra');
    await user.click(
      within(form).getByRole('button', { name: 'Registrar producción' }),
    );
    expect(
      await screen.findByText('Capuchino: Este producto ya no existe.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('form')).toBeNull();
  });

  it('los motivos sugeridos rellenan el campo, cambian con el tipo y siguen siendo editables', async () => {
    const back = fakeInventoryBack([capu()]);
    const user = userEvent.setup();
    renderWithQuery(<InventoryView />);
    const form = await openForm(user);
    await user.click(
      within(form).getByRole('button', { name: 'Producción del día' }),
    );
    expect(within(form).getByLabelText('Motivo')).toHaveValue(
      'Producción del día',
    );
    expect(
      within(form).getByRole('button', { name: 'Producción del día' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await user.type(within(form).getByLabelText('Motivo'), ' (turno 2)');
    expect(within(form).getByLabelText('Motivo')).toHaveValue(
      'Producción del día (turno 2)',
    );

    await user.click(within(form).getByLabelText('Merma o salida'));
    expect(
      within(form).queryByRole('button', { name: 'Producción del día' }),
    ).toBeNull();
    for (const name of ['Merma', 'Consumo interno', 'Ajuste por conteo'])
      expect(within(form).getByRole('button', { name })).toBeInTheDocument();
    await user.click(within(form).getByRole('button', { name: 'Merma' }));
    await user.type(within(form).getByLabelText('Cantidad'), '2');
    await user.click(
      within(form).getByRole('button', { name: 'Registrar salida' }),
    );
    await screen.findByText(/Salida registrada/);
    expect(back.calls.find((c) => c.method === 'POST')?.body).toMatchObject({
      type: 'OUT',
      reason: 'Merma',
    });
  });

  it('«Cancelar» cierra el formulario y devuelve el foco al botón', async () => {
    fakeInventoryBack([capu()]);
    const user = userEvent.setup();
    renderWithQuery(<InventoryView />);
    const form = await openForm(user);
    await user.click(within(form).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('form')).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Registrar movimiento de Capuchino' }),
    ).toHaveFocus();
  });
});

describe('InventoryView — historial', () => {
  const movements = [
    backMovement({
      id: 'm1',
      productId: 'p-capu',
      type: 'IN',
      quantity: 10,
      reason: 'Compra a proveedor',
    }),
    backMovement({
      id: 'm2',
      productId: 'p-capu',
      type: 'OUT',
      quantity: 2,
      reason: 'Pedido #1001',
      orderId: '3f2a9c1e-0b7d-4e5a-9c1d-aabbccddeeff',
      user: { id: 'u', username: 'sistema' },
    }),
    backMovement({
      id: 'm3',
      productId: 'p-gone',
      type: 'OUT',
      quantity: 1,
      reason: 'Merma',
    }),
  ];

  async function openHistory(user: ReturnType<typeof userEvent.setup>) {
    renderWithQuery(<InventoryView />);
    await user.click(await screen.findByRole('button', { name: 'Historial' }));
  }

  it('lista los movimientos con tipo, cantidad con signo, motivo, responsable y marca «Automático»', async () => {
    fakeInventoryBack([capu()], { movements });
    const user = userEvent.setup();
    await openHistory(user);
    expect(await screen.findByText('Compra a proveedor')).toBeInTheDocument();
    expect(screen.getAllByText('Producción').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Merma o salida').length).toBeGreaterThan(0);
    expect(screen.getByText(/\+10/)).toBeInTheDocument();
    expect(screen.getByText(/−2/)).toBeInTheDocument();
    expect(screen.getByText(/Automático · pedido ddeeff/)).toBeInTheDocument();
    expect(screen.getByText(/sistema/)).toBeInTheDocument();
    expect(screen.getByText('Producto eliminado')).toBeInTheDocument();
    expect(screen.getAllByText(/10 de nov, 10:00/).length).toBeGreaterThan(0);
  });

  it('filtra por tipo y por producto pidiéndolo al back', async () => {
    const back = fakeInventoryBack([capu()], { movements });
    const user = userEvent.setup();
    await openHistory(user);
    await screen.findByText('Compra a proveedor');
    await user.selectOptions(screen.getByLabelText('Tipo'), 'OUT');
    await screen.findByText('Pedido #1001');
    expect(screen.queryByText('Compra a proveedor')).toBeNull();
    expect(
      back.calls.some(
        (c) => c.url.includes('type=OUT') && c.url.includes('page=1'),
      ),
    ).toBe(true);
    await user.selectOptions(screen.getByLabelText('Producto'), 'p-capu');
    await screen.findByText('Pedido #1001');
    expect(back.calls.some((c) => c.url.includes('productId=p-capu'))).toBe(
      true,
    );
  });

  it('pagina de 20 en 20', async () => {
    const many = Array.from({ length: 25 }, (_, i) =>
      backMovement({
        id: `m${String(i)}`,
        productId: 'p-capu',
        reason: `Motivo ${String(i)}`,
      }),
    );
    const back = fakeInventoryBack([capu()], { movements: many });
    const user = userEvent.setup();
    await openHistory(user);
    expect(await screen.findByText('Página 1 de 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Anterior' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(await screen.findByText('Página 2 de 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Siguiente' })).toBeDisabled();
    expect(back.calls.some((c) => c.url.includes('page=2'))).toBe(true);
  });

  it('sin movimientos lo dice', async () => {
    fakeInventoryBack([capu()]);
    const user = userEvent.setup();
    await openHistory(user);
    expect(
      await screen.findByText('Todavía no hay movimientos.'),
    ).toBeInTheDocument();
  });
});
