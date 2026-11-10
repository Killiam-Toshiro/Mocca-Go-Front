import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { MenuItem } from '@/lib/menu/categories';
import { serializeCart } from './cart';
import { CART_KEY, resetStorageForTests } from './storage';
import {
  acknowledgePrices,
  addToCart,
  changeQuantity,
  clearCart,
  dismissNotice,
  getServerSnapshot,
  getSnapshot,
  removeFromCart,
  resetCartStoreForTests,
  subscribe,
  syncWithMenu,
} from './store';

const cap = { id: 'cap', name: 'Capuchino', price: 4500 };
const pan = { id: 'pan', name: 'Pandebono', price: 2500 };
const menuItem = (id: string, price: number): MenuItem =>
  ({
    id,
    sku: id,
    name: id,
    description: null,
    category: 'cafe',
    price,
    available: true,
    components: [],
  }) as MenuItem;

beforeEach(() => {
  resetStorageForTests();
  resetCartStoreForTests();
  window.localStorage.clear();
});
afterEach(() => window.localStorage.clear());

describe('almacén del carrito', () => {
  it('en el servidor y en la hidratación el carrito está vacío', () => {
    window.localStorage.setItem(
      CART_KEY,
      serializeCart([
        { productId: 'cap', name: 'C', quantity: 1, seenPrice: 1 },
      ]),
    );
    expect(getServerSnapshot().cart).toEqual([]);
    expect(getSnapshot().cart).toHaveLength(1); // el cliente sí lee lo guardado
  });

  it('agregar guarda en localStorage y avisa a quien escucha', () => {
    let calls = 0;
    const off = subscribe(() => (calls += 1));
    expect(addToCart(cap, 2)).toBe('added');
    expect(calls).toBe(1);
    expect(getSnapshot().cart[0]).toMatchObject({
      productId: 'cap',
      quantity: 2,
    });
    expect(window.localStorage.getItem(CART_KEY)).toContain('Capuchino');
    off();
  });

  it('el estado cambia de identidad solo cuando algo cambia', () => {
    addToCart(cap);
    const before = getSnapshot();
    expect(addToCart(cap, 10)).toBe('max-quantity'); // 1 + 10 > 10
    expect(getSnapshot()).toBe(before);
  });

  it('cambiar cantidad, quitar y vaciar', () => {
    addToCart(cap);
    addToCart(pan);
    changeQuantity('cap', 4);
    expect(
      getSnapshot().cart.find((l) => l.productId === 'cap')!.quantity,
    ).toBe(4);
    removeFromCart('pan');
    expect(getSnapshot().cart.map((l) => l.productId)).toEqual(['cap']);
    clearCart();
    expect(getSnapshot().cart).toEqual([]);
    expect(window.localStorage.getItem(CART_KEY)).toBeNull();
  });

  it('anuncia cada cambio con el estado del carrito', () => {
    addToCart(cap, 2);
    expect(getSnapshot().announcement.text).toBe(
      'Capuchino agregado (2). Carrito: 2 productos.',
    );
    const tick = getSnapshot().announcement.tick;
    removeFromCart('cap');
    expect(getSnapshot().announcement.text).toBe(
      'Capuchino quitado. Carrito vacío.',
    );
    expect(getSnapshot().announcement.tick).toBeGreaterThan(tick);
  });

  it('sincroniza con otra pestaña (evento storage): gana la última escritura', () => {
    let calls = 0;
    const off = subscribe(() => (calls += 1));
    addToCart(cap);
    calls = 0;
    window.localStorage.setItem(
      CART_KEY,
      serializeCart([
        { productId: 'pan', name: 'Pandebono', quantity: 3, seenPrice: 2500 },
      ]),
    );
    window.dispatchEvent(new StorageEvent('storage', { key: CART_KEY }));
    expect(calls).toBe(1);
    expect(getSnapshot().cart.map((l) => l.productId)).toEqual(['pan']);
    window.dispatchEvent(new StorageEvent('storage', { key: 'otra-clave' }));
    expect(calls).toBe(1);
    off();
  });

  it('syncWithMenu quita lo retirado y deja un aviso que se puede descartar', () => {
    addToCart(cap);
    addToCart(pan);
    syncWithMenu([menuItem('cap', 4500)]);
    expect(getSnapshot().cart.map((l) => l.productId)).toEqual(['cap']);
    const [notice] = getSnapshot().notices;
    expect(notice!.text).toBe(
      'Pandebono ya no está en el menú y se quitó de tu carrito.',
    );
    dismissNotice(notice!.id);
    expect(getSnapshot().notices).toEqual([]);
  });

  it('syncWithMenu sin retirados no cambia nada', () => {
    addToCart(cap);
    const before = getSnapshot();
    syncWithMenu([menuItem('cap', 4500)]);
    expect(getSnapshot()).toBe(before);
  });

  it('acknowledgePrices actualiza el precio visto', () => {
    addToCart(cap);
    acknowledgePrices([menuItem('cap', 5000)]);
    expect(getSnapshot().cart[0]!.seenPrice).toBe(5000);
  });

  it('un carrito guardado dañado se ignora', () => {
    window.localStorage.setItem(CART_KEY, '{basura');
    expect(getSnapshot().cart).toEqual([]);
  });
});
