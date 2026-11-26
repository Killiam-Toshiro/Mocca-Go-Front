import { describe, expect, it } from 'vitest';
import { whatsappHref } from './contact';
import {
  clock,
  finishedText,
  isOverdue,
  itemsSummary,
  overdueMinutes,
  progressLabel,
  replaceOrder,
  roundProgress,
} from './rounds';
import type { Round } from './types';

const order = (id: string, status: string) =>
  ({
    id,
    status,
    items: [
      { quantity: 2, name: 'Capuchino' },
      { quantity: 1, name: 'Mocca' },
    ],
  }) as never;
const round = (statuses: string[], etaAt = '2026-11-10T20:00:00.000Z') =>
  ({
    id: 'r1',
    etaAt,
    orders: statuses.map((s, i) => order(`o${String(i)}`, s)),
  }) as unknown as Round;

describe('rondas', () => {
  it('cuenta el avance', () => {
    const p = roundProgress(
      round(['entregado', 'no_entregado', 'en_camino', 'en_camino']),
    );
    expect(p).toEqual({
      total: 4,
      delivered: 1,
      failed: 1,
      pending: 2,
      closed: 2,
    });
    expect(progressLabel(p)).toBe('1 de 4 entregados');
  });

  it('marca vencida solo con pedidos pendientes y pasada la hora', () => {
    const eta = Date.parse('2026-11-10T20:00:00.000Z');
    expect(overdueMinutes('2026-11-10T20:00:00.000Z', eta)).toBe(0);
    expect(overdueMinutes('2026-11-10T20:00:00.000Z', eta + 30_000)).toBe(1);
    expect(overdueMinutes('2026-11-10T20:00:00.000Z', eta + 4 * 60_000)).toBe(
      4,
    );
    expect(isOverdue(round(['en_camino']), eta + 4 * 60_000)).toBe(true);
    expect(isOverdue(round(['en_camino']), eta - 1)).toBe(false);
    expect(isOverdue(round(['entregado']), eta + 4 * 60_000)).toBe(false);
  });

  it('redacta el cierre y el resumen de productos', () => {
    expect(
      finishedText({
        total: 4,
        delivered: 3,
        failed: 1,
        pending: 0,
        closed: 4,
      }),
    ).toBe('Ronda terminada: 3 entregados, 1 no entregado');
    expect(
      finishedText({
        total: 1,
        delivered: 1,
        failed: 0,
        pending: 0,
        closed: 1,
      }),
    ).toBe('Ronda terminada: 1 entregado, 0 no entregados');
    expect(itemsSummary(order('x', 'listo'))).toBe('2 × Capuchino, 1 × Mocca');
  });

  it('muestra la hora en Bogotá', () => {
    expect(clock('2026-11-10T20:45:00.000Z')).toMatch(/3:45\s?p\.\s?m\./);
  });

  it('reemplaza un pedido dentro de su ronda', () => {
    const rounds = [round(['en_camino', 'en_camino'])];
    const next = replaceOrder(rounds, order('o0', 'entregado'));
    expect(next[0]?.orders.map((o) => o.status)).toEqual([
      'entregado',
      'en_camino',
    ]);
    expect(rounds[0]?.orders[0]?.status).toBe('en_camino');
  });

  it('arma el WhatsApp del cliente como el back', () => {
    expect(whatsappHref('+573001234567')).toBe('https://wa.me/573001234567');
    expect(whatsappHref('3001234567')).toBeNull();
    expect(whatsappHref('abc')).toBeNull();
  });
});
