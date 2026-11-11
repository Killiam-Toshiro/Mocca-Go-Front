import { describe, expect, it } from 'vitest';
import {
  blockedReason,
  isPicked,
  MAX_ROUND_ORDERS,
  NO_SELECTION,
  prune,
  toggle,
} from './selection';
import type { Queue } from './types';

const pick = (n: number) => ({ id: `o${String(n)}`, number: 1000 + n });

describe('selección de pedidos', () => {
  it('marca, desmarca y libera la zona al quedar vacía', () => {
    let s = toggle(NO_SELECTION, 'z1', pick(1));
    expect(s).toEqual({ zoneId: 'z1', picks: [pick(1)] });
    s = toggle(s, 'z1', pick(2));
    expect(s.picks).toHaveLength(2);
    s = toggle(s, 'z1', pick(1));
    s = toggle(s, 'z1', pick(2));
    expect(s).toEqual(NO_SELECTION);
  });

  it('no mezcla zonas ni pasa del máximo, pero siempre deja quitar', () => {
    let s = toggle(NO_SELECTION, 'z1', pick(1));
    expect(blockedReason(s, 'z2', 'x')).toBe('other-zone');
    expect(toggle(s, 'z2', pick(9))).toBe(s);
    for (let i = 2; i <= MAX_ROUND_ORDERS; i += 1) s = toggle(s, 'z1', pick(i));
    expect(s.picks).toHaveLength(MAX_ROUND_ORDERS);
    expect(blockedReason(s, 'z1', 'nuevo')).toBe('full');
    expect(toggle(s, 'z1', pick(99))).toBe(s);
    expect(blockedReason(s, 'z1', pick(1).id)).toBeNull();
    expect(isPicked(toggle(s, 'z1', pick(1)), pick(1).id)).toBe(false);
  });

  it('prune quita los pedidos que ya no están en la cola y avisa cuáles', () => {
    const s = { zoneId: 'z1', picks: [pick(1), pick(2), pick(3)] };
    const queue = {
      suggestedZoneId: 'z1',
      zones: [
        {
          zoneId: 'z1',
          zoneName: 'Zona 1',
          oldestNumber: 1001,
          orders: [{ id: 'o1' }, { id: 'o3' }],
        },
      ],
    } as unknown as Queue;
    const r = prune(s, queue);
    expect(r.selection.picks.map((p) => p.id)).toEqual(['o1', 'o3']);
    expect(r.removed).toEqual([pick(2)]);
    expect(prune(s, undefined).selection).toBe(s);
    const none = prune(s, { suggestedZoneId: null, zones: [] });
    expect(none.selection).toEqual(NO_SELECTION);
    expect(none.removed).toHaveLength(3);
    const same = prune(r.selection, queue);
    expect(same.selection).toBe(r.selection);
  });
});
