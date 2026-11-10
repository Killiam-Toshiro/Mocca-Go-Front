'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';

/**
 * Detecta pedidos nuevos en «Por preparar» (D-061): la primera carga solo registra los que hay;
 * después, cada pedido nuevo se anuncia y, si la pestaña está oculta, suma al contador del título.
 */
export function useNewKitchenOrders(): {
  announcement: string;
  unseen: number;
} {
  const queryClient = useQueryClient();
  const [announcement, setAnnouncement] = useState('');
  const [unseen, setUnseen] = useState(0);

  useEffect(() => {
    let known: Set<string> | null = null;
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success') return;
      const key = event.query.queryKey;
      if (key[0] !== 'kitchen' || key[1] !== 'recibido') return;
      const data = (event.query.state.data as { data?: unknown } | undefined)
        ?.data;
      if (!Array.isArray(data)) return;
      const orders = data.filter(
        (o): o is { id: string; number: number } =>
          typeof o === 'object' &&
          o !== null &&
          typeof (o as { id?: unknown }).id === 'string' &&
          typeof (o as { number?: unknown }).number === 'number',
      );
      const previous = known;
      known = new Set(orders.map((o) => o.id));
      if (previous === null) return;
      const fresh = orders.filter((o) => !previous.has(o.id));
      if (fresh.length === 0) return;
      setAnnouncement(
        fresh.length === 1
          ? `Nuevo pedido #${String(fresh[0]?.number)}`
          : `Nuevos pedidos: ${fresh.map((o) => `#${String(o.number)}`).join(', ')}`,
      );
      if (document.visibilityState === 'hidden')
        setUnseen((n) => n + fresh.length);
    });

    const onVisible = () => {
      if (document.visibilityState === 'visible') setUnseen(0);
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      unsubscribe();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [queryClient]);

  return { announcement, unseen };
}

/** Pone «(3) Cocina» en el título de la pestaña mientras haya pedidos sin ver. */
export function useTitleCount(count: number): void {
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s*/, '');
    document.title = count > 0 ? `(${String(count)}) ${base}` : base;
    return () => {
      document.title = base;
    };
  }, [count]);
}
