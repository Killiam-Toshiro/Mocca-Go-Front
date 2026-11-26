'use client';

import type { MenuItem } from '@/lib/menu/categories';
import {
  acknowledgePrices as acknowledgeLines,
  addLine,
  EMPTY_CART,
  parseCart,
  pruneRetired,
  serializeCart,
  setQuantity,
  type AddStatus,
  type Cart,
} from './cart';
import { CART_KEY, clearRaw, readRaw, writeRaw } from './storage';

export interface CartNotice {
  id: number;
  text: string;
}

export interface CartState {
  cart: Cart;
  /** Avisos que el cliente debe ver y descartar (no se guardan). */
  notices: readonly CartNotice[];
  /** Último cambio, para leerlo con `aria-live` (`tick` permite repetir el mismo texto). */
  announcement: { text: string; tick: number };
}

const SERVER_STATE: CartState = {
  cart: EMPTY_CART,
  notices: [],
  announcement: { text: '', tick: 0 },
};

let state: CartState = SERVER_STATE;
let loaded = false;
let noticeId = 0;
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function set(patch: Partial<CartState>): void {
  state = { ...state, ...patch };
  emit();
}

function ensureLoaded(): void {
  if (loaded || typeof window === 'undefined') return;
  loaded = true;
  state = { ...state, cart: parseCart(readRaw()) };
}

function persist(cart: Cart): void {
  if (cart.length === 0) clearRaw();
  else writeRaw(serializeCart(cart));
}

function units(cart: Cart): number {
  return cart.reduce((sum, line) => sum + line.quantity, 0);
}

function announce(text: string, cart: Cart): CartState['announcement'] {
  const products = units(cart);
  const summary =
    products === 0
      ? 'Carrito vacío.'
      : `Carrito: ${products} ${products === 1 ? 'producto' : 'productos'}.`;
  return { text: `${text} ${summary}`, tick: state.announcement.tick + 1 };
}

function onStorage(event: StorageEvent): void {
  if (event.key !== null && event.key !== CART_KEY) return;
  // Otra pestaña cambió el carrito: gana la última escritura.
  state = { ...state, cart: parseCart(readRaw()) };
  emit();
}

export function subscribe(listener: () => void): () => void {
  if (listeners.size === 0 && typeof window !== 'undefined')
    window.addEventListener('storage', onStorage);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && typeof window !== 'undefined')
      window.removeEventListener('storage', onStorage);
  };
}

export function getSnapshot(): CartState {
  ensureLoaded();
  return state;
}

/** Servidor y primera hidratación: carrito vacío, sin discrepancias. */
export function getServerSnapshot(): CartState {
  return SERVER_STATE;
}

export function addToCart(
  product: Pick<MenuItem, 'id' | 'name' | 'price'>,
  quantity = 1,
): AddStatus {
  ensureLoaded();
  const result = addLine(state.cart, product, quantity);
  if (result.cart !== state.cart) {
    persist(result.cart);
    set({
      cart: result.cart,
      announcement: announce(
        `${product.name} agregado${quantity > 1 ? ` (${quantity})` : ''}.`,
        result.cart,
      ),
    });
  }
  return result.status;
}

export function changeQuantity(productId: string, quantity: number): void {
  ensureLoaded();
  const cart = setQuantity(state.cart, productId, quantity);
  if (cart === state.cart) return;
  const name = state.cart.find((l) => l.productId === productId)?.name ?? '';
  persist(cart);
  set({
    cart,
    announcement: announce(
      cart.some((l) => l.productId === productId)
        ? `${name}: ${quantity}.`
        : `${name} quitado.`,
      cart,
    ),
  });
}

export function removeFromCart(productId: string): void {
  changeQuantity(productId, 0);
}

export function clearCart(): void {
  ensureLoaded();
  clearRaw();
  set({
    cart: EMPTY_CART,
    notices: [],
    announcement: announce('Carrito vaciado.', EMPTY_CART),
  });
}

/**
 * Cruza el carrito con un menú recién cargado: quita lo retirado (con aviso) y
 * deja constancia de ello. Los precios nuevos se avisan desde `reconcile`.
 */
export function syncWithMenu(menu: readonly MenuItem[]): void {
  ensureLoaded();
  const { cart, removed } = pruneRetired(state.cart, menu);
  if (removed.length === 0) return;
  persist(cart);
  const names = removed.map((line) => line.name).join(', ');
  noticeId += 1;
  set({
    cart,
    notices: [
      ...state.notices,
      {
        id: noticeId,
        text:
          removed.length === 1
            ? `${names} ya no está en el menú y se quitó de tu carrito.`
            : `Estos productos ya no están en el menú y se quitaron de tu carrito: ${names}.`,
      },
    ],
  });
}

/** «Entendido» ante un precio nuevo: el precio vigente pasa a ser el visto. */
export function acknowledgePrices(menu: readonly MenuItem[]): void {
  ensureLoaded();
  const cart = acknowledgeLines(state.cart, menu);
  if (cart === state.cart) return;
  persist(cart);
  set({ cart });
}

export function dismissNotice(id: number): void {
  set({ notices: state.notices.filter((notice) => notice.id !== id) });
}

/** Solo para pruebas: vuelve al estado inicial. */
export function resetCartStoreForTests(): void {
  state = SERVER_STATE;
  loaded = false;
  noticeId = 0;
  listeners.clear();
}
