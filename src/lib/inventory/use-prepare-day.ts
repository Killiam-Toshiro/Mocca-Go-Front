'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useReducer, useRef } from 'react';
import { requestJson } from '@/lib/api/json';
import { buildPlan, parseTarget } from './day-plan';
import { describeInventoryError } from './errors';
import type { CreatedMovement, MovementType, ProductPage } from './types';
import { fetchProducts } from './use-products';

export type RowResult =
  | { status: 'ok'; type: MovementType; quantity: number; stock: number }
  | { status: 'failed'; messages: string[] }
  | { status: 'ambiguous'; messages: string[] }
  | { status: 'omitted' };

export type DayPhase = 'idle' | 'running' | 'done';

export interface DayState {
  phase: DayPhase;
  progress: { done: number; total: number };
  results: Record<string, RowResult>;
  /** No se pudo ni empezar (p. ej. no se pudo consultar el catálogo): no se envió nada. */
  fatal: string | null;
}

type Action =
  | { type: 'start' }
  | { type: 'plan'; total: number; omitted: string[] }
  | { type: 'result'; id: string; result: RowResult }
  | { type: 'done' }
  | { type: 'fatal'; message: string }
  | { type: 'clear'; id: string };

const INITIAL: DayState = {
  phase: 'idle',
  progress: { done: 0, total: 0 },
  results: {},
  fatal: null,
};

function reducer(state: DayState, action: Action): DayState {
  switch (action.type) {
    case 'start':
      return {
        ...state,
        phase: 'running',
        progress: { done: 0, total: 0 },
        fatal: null,
        // Los resultados de una tanda anterior se limpian; las filas ambiguas se conservan.
        results: Object.fromEntries(
          Object.entries(state.results).filter(
            ([, r]) => r.status === 'ambiguous',
          ),
        ),
      };
    case 'plan': {
      const results = { ...state.results };
      for (const id of action.omitted) results[id] = { status: 'omitted' };
      return { ...state, progress: { done: 0, total: action.total }, results };
    }
    case 'result':
      return {
        ...state,
        progress: { ...state.progress, done: state.progress.done + 1 },
        results: { ...state.results, [action.id]: action.result },
      };
    case 'done':
      return { ...state, phase: 'done' };
    case 'fatal':
      return { ...state, phase: 'done', fatal: action.message };
    case 'clear': {
      const results = { ...state.results };
      delete results[action.id];
      return { ...state, results };
    }
  }
}

/**
 * «Preparar el día» (D-078 a D-081): vuelve a consultar el catálogo, calcula la diferencia con el
 * saldo más reciente y envía **un movimiento por producto, de uno en uno**. Un movimiento no es
 * idempotente: nunca se reintenta; un fallo no detiene el resto; un corte de red deja la fila
 * «ambigua» (pudo registrarse).
 */
export function usePrepareDay() {
  const queryClient = useQueryClient();
  const [state, dispatch] = useReducer(reducer, INITIAL);
  const busy = useRef(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    // Al salir de la pantalla no se envían más filas (lo ya enviado queda en el historial).
    return () => {
      alive.current = false;
    };
  }, []);

  async function run(
    targets: Record<string, string>,
    reason: string,
    /** Filas ambiguas: no se reenvían hasta que alguien revise el historial. */
    blocked: ReadonlySet<string> = new Set(),
  ): Promise<Record<string, RowResult>> {
    const collected: Record<string, RowResult> = {};
    if (busy.current) return collected;
    busy.current = true;
    dispatch({ type: 'start' });
    try {
      let fresh: ProductPage;
      try {
        fresh = await queryClient.fetchQuery({
          queryKey: ['products'],
          queryFn: fetchProducts,
          staleTime: 0,
        });
      } catch {
        dispatch({
          type: 'fatal',
          message:
            'No pudimos consultar los saldos más recientes, así que no se aplicó nada. Inténtalo de nuevo.',
        });
        return collected;
      }

      const allowed = Object.fromEntries(
        Object.entries(targets).filter(([id]) => !blocked.has(id)),
      );
      const plan = buildPlan(fresh.data, allowed);
      const planned = new Set(plan.map((r) => r.id));
      const omitted = fresh.data
        .filter((p) => {
          const parsed = parseTarget(allowed[p.id] ?? '');
          return parsed.ok && parsed.value !== null && !planned.has(p.id);
        })
        .map((p) => p.id);
      for (const id of omitted) collected[id] = { status: 'omitted' };
      dispatch({ type: 'plan', total: plan.length, omitted });

      for (const row of plan) {
        if (!alive.current) break;
        let result: RowResult;
        try {
          const created = await requestJson<CreatedMovement>('/api/movements', {
            method: 'POST',
            body: {
              productId: row.id,
              type: row.type,
              quantity: row.quantity,
              reason,
            },
            handleUnauthorized: true,
          });
          result = {
            status: 'ok',
            type: row.type,
            quantity: row.quantity,
            stock: created.stock,
          };
          queryClient.setQueryData<ProductPage>(['products'], (page) =>
            page
              ? {
                  ...page,
                  data: page.data.map((p) =>
                    p.id === row.id ? { ...p, stock: created.stock } : p,
                  ),
                }
              : page,
          );
        } catch (error) {
          const e = describeInventoryError(error, { writes: true });
          result =
            e.kind === 'ambiguous'
              ? { status: 'ambiguous', messages: e.messages }
              : { status: 'failed', messages: e.messages };
        }
        collected[row.id] = result;
        dispatch({ type: 'result', id: row.id, result });
      }
    } finally {
      void queryClient.invalidateQueries({ queryKey: ['products'] });
      void queryClient.invalidateQueries({ queryKey: ['movements'] });
      busy.current = false;
      dispatch({ type: 'done' });
    }
    return collected;
  }

  return {
    state,
    run,
    /** Quita el resultado de una fila (p. ej. «Ya lo revisé» en una ambigua). */
    clear: (id: string) => dispatch({ type: 'clear', id }),
  };
}
