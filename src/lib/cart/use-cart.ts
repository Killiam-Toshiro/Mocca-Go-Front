'use client';

import { useSyncExternalStore } from 'react';
import {
  getServerSnapshot,
  getSnapshot,
  subscribe,
  type CartState,
} from './store';

/** Estado del carrito (líneas, avisos y último anuncio). Vacío en el servidor. */
export function useCartState(): CartState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function useCart() {
  return useCartState().cart;
}
