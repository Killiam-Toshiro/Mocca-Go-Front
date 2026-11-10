import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { MenuItem } from '@/lib/menu/categories';
import { ProductDetail } from './product-detail';

const COMBO = {
  id: 'cmb',
  sku: 'CMB',
  name: 'Combo Clásico',
  description: 'Capuchino y pandebono.',
  category: 'combo',
  price: 6500,
  available: true,
  components: [
    { name: 'Capuchino', quantity: 1 },
    { name: 'Pandebono', quantity: 2 },
  ],
} as MenuItem;

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function showModal(
    this: HTMLDialogElement,
  ) {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
});

function mount(
  item: MenuItem,
  props: { canOrder?: boolean; onAdd?: never } = {},
) {
  const onAdd = vi.fn(() => 'added' as const);
  const onClose = vi.fn();
  render(
    <ProductDetail
      item={item}
      canOrder={props.canOrder ?? true}
      cart={[]}
      onClose={onClose}
      onAdd={onAdd}
    />,
  );
  return { onAdd, onClose };
}

describe('ProductDetail', () => {
  it('lista los componentes del combo y agrega la cantidad elegida', async () => {
    const { onAdd, onClose } = mount(COMBO);
    expect(screen.getByText('2 × Pandebono')).toBeInTheDocument();
    await userEvent.click(
      screen.getByRole('button', {
        name: 'Agregar una unidad de Combo Clásico',
      }),
    );
    await userEvent.click(
      screen.getByRole('button', { name: /Agregar · \$13\.000/ }),
    );
    expect(onAdd).toHaveBeenCalledWith(COMBO, 2);
    expect(onClose).toHaveBeenCalled();
  });

  it('un agotado no se puede agregar', () => {
    mount({ ...COMBO, available: false });
    expect(screen.getByText('Agotado por ahora.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Agregar ·/ }),
    ).not.toBeInTheDocument();
  });

  it('sin descripción muestra el texto de reemplazo y el personal no ve cantidad', () => {
    mount({ ...COMBO, description: null, components: [] }, { canOrder: false });
    expect(screen.getByText('Sin descripción.')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Agregar ·/ }),
    ).not.toBeInTheDocument();
  });

  it('muestra el aviso si se pasa del límite y no cierra', async () => {
    const onAdd = vi.fn(() => 'max-quantity' as const);
    const onClose = vi.fn();
    render(
      <ProductDetail
        item={COMBO}
        canOrder
        cart={[]}
        onClose={onClose}
        onAdd={onAdd}
      />,
    );
    await userEvent.click(screen.getByRole('button', { name: /Agregar ·/ }));
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });
});
