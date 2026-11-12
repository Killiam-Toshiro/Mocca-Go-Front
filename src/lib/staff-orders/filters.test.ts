import { describe, expect, it } from 'vitest';
import { kitchenOrder } from '../../../tests/utils/kitchen';
import { canCancel, STATUS_FILTERS } from './filters';
import { customerLine, deliveryLine, telHref } from './format';
import { staffOrdersUrl } from './use-staff-orders';

describe('filtros y formato de pedidos del personal', () => {
  it('ofrece «todos» y los siete estados del back', () => {
    expect(STATUS_FILTERS.map((f) => f.value)).toEqual([
      'todos',
      'recibido',
      'en_preparacion',
      'listo',
      'en_camino',
      'entregado',
      'no_entregado',
      'cancelado',
    ]);
  });

  it('solo se cancela en recibido y en preparación', () => {
    expect(
      ['recibido', 'en_preparacion', 'listo', 'en_camino', 'entregado'].map(
        canCancel,
      ),
    ).toEqual([true, true, false, false, false]);
  });

  it('arma la URL con página, 20 por página y estado solo si se filtra', () => {
    expect(staffOrdersUrl(1, 'todos')).toBe('/api/orders?page=1&limit=20');
    expect(staffOrdersUrl(3, 'en_camino')).toBe(
      '/api/orders?page=3&limit=20&status=en_camino',
    );
  });

  it('describe cliente y entrega', () => {
    const order = kitchenOrder();
    expect(customerLine(order)).toBe('Carlos Sarmiento · +573005874455');
    expect(deliveryLine(order)).toBe('Zona 1 · Edificio A · Piso 2');
    expect(telHref('+573005874455')).toBe('tel:+573005874455');
  });
});
