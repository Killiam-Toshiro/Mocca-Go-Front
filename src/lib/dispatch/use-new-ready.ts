'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import type { Queue } from './types';

/**
 * Detecta pedidos nuevos en la cola de despacho: la primera carga solo registra los que hay;
 * después, cada pedido nuevo se anuncia y, con la pestaña oculta, suma al contador del título.
 */
export function useNewReadyOrders(): { announcement: string; unseen: number } {
  const queryClient = useQueryClient();
  const [announcement, setAnnouncement] = useState('');
  const [unseen, setUnseen] = useState(0);

  useEffect(() => {
    let known: Set<string> | null = null;
    const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
      if (event.type !== 'updated' || event.action.type !== 'success') return;
      const key = event.query.queryKey;
      if (key[0] !== 'dispatch' || key[1] !== 'queue') return;
      const zones = (event.query.state.data as Queue | undefined)?.zones;
      if (!Array.isArray(zones)) return;
      const orders = zones.flatMap((z) =>
        z.orders.map((o) => ({ id: o.id, number: o.number })),
      );
      const previous = known;
      known = new Set(orders.map((o) => o.id));
      if (previous === null) return;
      const fresh = orders.filter((o) => !previous.has(o.id));
      if (fresh.length === 0) return;
      setAnnouncement(
        fresh.length === 1
          ? `Pedido #${String(fresh[0]?.number)} listo para repartir`
          : `Pedidos listos para repartir: ${fresh.map((o) => `#${String(o.number)}`).join(', ')}`,
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
