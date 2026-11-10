import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearDraft,
  DRAFT_KEY,
  loadDraft,
  reconcileDraft,
  saveDraft,
} from './draft';
import { resetSessionStoreForTests } from './session-store';

beforeEach(() => {
  window.sessionStorage.clear();
  resetSessionStoreForTests();
});

const draft = {
  pointId: 'p1',
  floor: 2,
  deliveryNote: 'puerta',
  note: 'sin azúcar',
};

describe('borrador', () => {
  it('guarda y recupera punto, piso y notas', () => {
    saveDraft(draft);
    expect(loadDraft()).toEqual(draft);
    clearDraft();
    expect(loadDraft()).toBeNull();
  });
  it('no guarda nada que parezca una tarjeta aunque llegue en el objeto', () => {
    saveDraft({ ...draft, cardNumber: '4242424242424242' } as typeof draft);
    expect(window.sessionStorage.getItem(DRAFT_KEY)).not.toContain('4242');
  });
  it('descarta datos dañados o inválidos', () => {
    window.sessionStorage.setItem(DRAFT_KEY, '{nope');
    expect(loadDraft()).toBeNull();
    window.sessionStorage.setItem(
      DRAFT_KEY,
      JSON.stringify({ ...draft, floor: 99 }),
    );
    expect(loadDraft()).toBeNull();
  });
  it('se reconcilia con las zonas activas', () => {
    const zones = [
      {
        points: [
          { id: 'p1', floors: 4 },
          { id: 'p2', floors: null },
        ],
      },
    ];
    expect(reconcileDraft(draft, zones)).toEqual(draft);
    expect(reconcileDraft({ ...draft, pointId: 'borrado' }, zones)).toBeNull();
    expect(
      reconcileDraft({ ...draft, pointId: 'p2' }, zones)?.floor,
    ).toBeNull();
    expect(reconcileDraft({ ...draft, floor: 9 }, zones)?.floor).toBeNull();
    expect(reconcileDraft(null, zones)).toBeNull();
  });
});
