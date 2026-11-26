'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { describeZoneError, type ZoneError } from './errors';
import { invalidateZones } from './use-admin-zones';

export interface ActionHandlers<R> {
  /** `recovered`: se aplicó pero la respuesta se perdió; se confirmó al consultar. */
  onDone?: (result: R, how: 'sent' | 'recovered') => void;
  onFail?: (error: ZoneError) => void;
}

/**
 * Base de las escrituras de zonas y puntos (D-111, D-118): marca síncrona contra el doble clic, sin
 * reintento automático y, tras un corte de red, `recover` consulta las zonas para confirmar si el
 * cambio se aplicó (devuelve `{ found }` si se aplicó, o `null`).
 */
export function useZoneAction<A, R>(
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
      invalidateZones(queryClient);
      h.onDone?.(result, 'sent');
    } catch (error) {
      const described = describeZoneError(error);
      invalidateZones(queryClient);
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
