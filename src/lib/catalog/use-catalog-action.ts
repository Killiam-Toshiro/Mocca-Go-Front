'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { describeCatalogError, type CatalogError } from './errors';
import { invalidateCatalog } from './use-catalog';

export interface ActionHandlers<R> {
  /** `recovered`: se aplicó pero la respuesta se perdió; se confirmó al consultar. */
  onDone?: (result: R, how: 'sent' | 'recovered') => void;
  onFail?: (error: CatalogError) => void;
}

/**
 * Base de las acciones de escritura del catálogo (D-118): marca síncrona contra el doble clic, sin
 * reintento automático y, tras un corte de red, `recover` consulta el catálogo para confirmar si el
 * cambio se aplicó (devuelve `{ found }` si se aplicó, o `null`).
 */
export function useCatalogAction<A, R>(
  request: (args: A) => Promise<R>,
  recover: ((args: A) => Promise<{ found: R } | null>) | null,
  handlers: ActionHandlers<R> = {},
) {
  const queryClient = useQueryClient();
  const busy = useRef(false);
  const latest = useRef({ handlers, request, recover });
  const [pending, setPending] = useState(false);
  useEffect(() => {
    latest.current = { handlers, request, recover };
  });

  async function run(args: A) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    const { handlers: h } = latest.current;
    try {
      const result = await latest.current.request(args);
      invalidateCatalog(queryClient);
      h.onDone?.(result, 'sent');
    } catch (error) {
      const described = describeCatalogError(error);
      invalidateCatalog(queryClient);
      if (described.kind !== 'ambiguous' || !latest.current.recover) {
        h.onFail?.(described);
        return;
      }
      try {
        const found = await latest.current.recover(args);
        if (found) h.onDone?.(found.found, 'recovered');
        else h.onFail?.(described);
      } catch {
        h.onFail?.(described);
      }
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return { run, pending };
}
