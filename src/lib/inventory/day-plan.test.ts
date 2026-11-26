import { describe, expect, it } from 'vitest';
import {
  buildPlan,
  parseTarget,
  preparable,
  summarize,
  summaryText,
  targetErrors,
} from './day-plan';
import { toStaffProduct } from './types';
import { backProduct } from '../../../tests/utils/inventory';

const p = (o: Parameters<typeof backProduct>[0]) =>
  toStaffProduct(backProduct(o));

describe('parseTarget', () => {
  it('vacío no cambia nada', () => {
    expect(parseTarget('')).toEqual({ ok: true, value: null });
    expect(parseTarget('   ')).toEqual({ ok: true, value: null });
  });
  it('acepta enteros de 0 a 100 000', () => {
    expect(parseTarget('0')).toEqual({ ok: true, value: 0 });
    expect(parseTarget(' 50 ')).toEqual({ ok: true, value: 50 });
    expect(parseTarget('100000')).toEqual({ ok: true, value: 100_000 });
  });
  it('rechaza decimales, signos, ceros iniciales, texto y valores sobre el máximo', () => {
    for (const bad of ['1.5', '1,5', '-3', '+3', '03', 'abc', '1e3', '1234567'])
      expect(parseTarget(bad).ok, bad).toBe(false);
    expect(parseTarget('100001')).toEqual({
      ok: false,
      error: 'El máximo es 100000.',
    });
  });
});

describe('buildPlan', () => {
  const capu = p({ id: 'capu', name: 'Capuchino', stock: 20 });
  const pan = p({ id: 'pan', name: 'Pandebono', stock: 30 });
  const igual = p({ id: 'igual', name: 'Brownie', stock: 10 });

  it('sube → IN, baja → OUT, igual y vacío → fuera', () => {
    const plan = buildPlan([capu, pan, igual], {
      capu: '50',
      pan: '10',
      igual: '10',
    });
    expect(plan).toEqual([
      {
        id: 'capu',
        name: 'Capuchino',
        current: 20,
        target: 50,
        delta: 30,
        type: 'IN',
        quantity: 30,
      },
      {
        id: 'pan',
        name: 'Pandebono',
        current: 30,
        target: 10,
        delta: -20,
        type: 'OUT',
        quantity: 20,
      },
    ]);
    expect(buildPlan([capu], {})).toEqual([]);
  });
  it('bajar a 0 es una salida con todo el saldo', () => {
    expect(buildPlan([capu], { capu: '0' })[0]).toMatchObject({
      type: 'OUT',
      quantity: 20,
    });
  });
  it('ignora combos, inactivos y valores inválidos', () => {
    const combo = p({ id: 'c', category: 'combo', stock: 5 });
    const off = p({ id: 'o', active: false, stock: 5 });
    expect(
      buildPlan([combo, off, capu], { c: '9', o: '9', capu: 'x' }),
    ).toEqual([]);
    expect(preparable([combo, off, capu]).map((x) => x.id)).toEqual(['capu']);
  });
});

describe('summarize', () => {
  it('cuenta productos y unidades que suben y bajan', () => {
    const plan = buildPlan(
      [
        p({ id: 'a', stock: 0 }),
        p({ id: 'b', stock: 0 }),
        p({ id: 'c', stock: 10 }),
      ],
      { a: '5', b: '7', c: '4' },
    );
    expect(summarize(plan)).toEqual({
      total: 3,
      up: 2,
      down: 1,
      unitsUp: 12,
      unitsDown: 6,
    });
    expect(summaryText(summarize(plan))).toBe('3 productos: 2 suben, 1 baja');
    expect(summaryText(summarize(plan.slice(0, 1)))).toBe('1 producto: 1 sube');
  });
});

describe('targetErrors', () => {
  it('reporta los campos con formato inválido', () => {
    const a = p({ id: 'a' });
    const b = p({ id: 'b' });
    expect(targetErrors([a, b], { a: '1.5', b: '4' })).toEqual({
      a: 'Escribe un número entero de 0 en adelante, sin decimales.',
    });
  });
});
