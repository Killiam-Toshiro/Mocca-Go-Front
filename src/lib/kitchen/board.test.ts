import { describe, expect, it } from 'vitest';
import { kitchenOrder, kitchenPage } from '../../../tests/utils/kitchen';
import {
  insertOrder,
  isLongWait,
  isKitchenStatus,
  LONG_WAIT_MINUTES,
  READY_VISIBLE,
  removeOrder,
  sinceFor,
  telHref,
  visibleReady,
  waitLabel,
  waitMinutes,
} from './board';

describe('tiempo de espera', () => {
  const since = '2026-11-10T18:00:00.000Z';
  const at = (min: number, sec = 0) =>
    Date.parse(since) + (min * 60 + sec) * 1000;

  it('cuenta minutos completos y nunca es negativo', () => {
    expect(waitMinutes(since, at(0, 59))).toBe(0);
    expect(waitMinutes(since, at(8, 1))).toBe(8);
    expect(waitMinutes(since, at(-3))).toBe(0);
    expect(waitMinutes('no es fecha', at(5))).toBe(0);
  });

  it('etiqueta en español', () => {
    expect(waitLabel(0)).toBe('hace un momento');
    expect(waitLabel(8)).toBe('hace 8 min');
    expect(waitLabel(60)).toBe('hace 1 h');
    expect(waitLabel(75)).toBe('hace 1 h 15 min');
  });

  it('marca espera larga desde 5, 15 y 10 minutos', () => {
    expect(LONG_WAIT_MINUTES).toEqual({
      recibido: 5,
      en_preparacion: 15,
      listo: 10,
    });
    expect(isLongWait('recibido', 4)).toBe(false);
    expect(isLongWait('recibido', 5)).toBe(true);
    expect(isLongWait('en_preparacion', 14)).toBe(false);
    expect(isLongWait('en_preparacion', 15)).toBe(true);
    expect(isLongWait('listo', 9)).toBe(false);
    expect(isLongWait('listo', 10)).toBe(true);
  });

  it('cuenta desde el último evento del estado actual', () => {
    const order = kitchenOrder({
      status: 'en_preparacion',
      events: [
        { status: 'recibido', at: '2026-11-10T18:00:00.000Z' },
        { status: 'en_preparacion', at: '2026-11-10T18:07:00.000Z' },
      ],
    });
    expect(sinceFor(order)).toBe('2026-11-10T18:07:00.000Z');
    expect(sinceFor(kitchenOrder({ status: 'listo' }))).toBe(
      '2026-11-10T18:00:00.000Z',
    );
  });
});

describe('colas', () => {
  it('«Listos» muestra los 10 más antiguos salvo que se pida ver todos', () => {
    const all = Array.from({ length: 14 }, (_, i) => i + 1);
    expect(READY_VISIBLE).toBe(10);
    expect(visibleReady(all, false)).toEqual(all.slice(0, 10));
    expect(visibleReady(all, true)).toEqual(all);
    expect(visibleReady([1, 2], false)).toEqual([1, 2]);
  });

  it('quita un pedido y descuenta el total', () => {
    const a = kitchenOrder({ number: 1001 });
    const b = kitchenOrder({ number: 1002 });
    const result = removeOrder(kitchenPage([a, b]), a.id)!;
    expect(result.data.map((o) => o.number)).toEqual([1002]);
    expect(result.total).toBe(1);
    const same = kitchenPage([b]);
    expect(removeOrder(same, a.id)).toBe(same);
    expect(removeOrder(undefined, a.id)).toBeUndefined();
  });

  it('inserta ordenado (el más antiguo primero) y reemplaza sin duplicar', () => {
    const a = kitchenOrder({ number: 1001 });
    const c = kitchenOrder({ number: 1003 });
    const b = kitchenOrder({ number: 1002 });
    const inserted = insertOrder(kitchenPage([a, c]), b)!;
    expect(inserted.data.map((o) => o.number)).toEqual([1001, 1002, 1003]);
    expect(inserted.total).toBe(3);
    const replaced = insertOrder(inserted, { ...b, note: 'sin azúcar' })!;
    expect(replaced.data).toHaveLength(3);
    expect(replaced.total).toBe(3);
    expect(replaced.data[1]?.note).toBe('sin azúcar');
    expect(insertOrder(undefined, a)).toBeUndefined();
  });

  it('reconoce los estados de cocina', () => {
    expect(isKitchenStatus('listo')).toBe(true);
    expect(isKitchenStatus('en_camino')).toBe(false);
  });
});

describe('telHref', () => {
  it('enlaza solo teléfonos con la forma esperada', () => {
    expect(telHref('+573005874455')).toBe('tel:+573005874455');
    expect(telHref('300 587 4455')).toBe('tel:3005874455');
    expect(telHref('javascript:alert(1)')).toBeNull();
    expect(telHref('123')).toBeNull();
    expect(telHref('')).toBeNull();
  });
});
