'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { requestJson } from '@/lib/api/json';
import type { Order } from '@/lib/orders/types';
import { describeSurveyError, type SurveyError } from './errors';
import { surveyBody } from './rating';

export type SurveyData = NonNullable<Order['survey']>;

export interface SubmitSurveyHandlers {
  /** `already`: otra pestaña la guardó antes; `recovered`: se guardó pero la respuesta se perdió. */
  onDone?: (survey: SurveyData, how: 'sent' | 'already' | 'recovered') => void;
  onFail?: (error: SurveyError) => void;
}

function orderKey(id: string) {
  return ['order', id] as const;
}

async function fetchOrder(id: string): Promise<Order> {
  return requestJson<Order>(`/api/orders/${encodeURIComponent(id)}`, {
    method: 'GET',
    handleUnauthorized: true,
  });
}

/**
 * `POST /orders/:id/survey`. **No es idempotente** (una sola respuesta, no se edita): no se reintenta
 * nunca y una marca síncrona frena el doble clic. Tras un corte de red se consulta el pedido antes de
 * decir si se guardó (D-070).
 */
export function useSubmitSurvey(
  orderId: string,
  handlers: SubmitSurveyHandlers = {},
) {
  const queryClient = useQueryClient();
  const busy = useRef(false);
  const latest = useRef(handlers);
  const [pending, setPending] = useState(false);
  useEffect(() => {
    latest.current = handlers;
  });

  function store(survey: SurveyData) {
    queryClient.setQueryData<Order>(orderKey(orderId), (order) =>
      order ? { ...order, survey } : order,
    );
    void queryClient.invalidateQueries({ queryKey: ['orders'] });
  }

  /** Consulta el pedido real; devuelve su encuesta o `null` si no hay (o no se pudo consultar). */
  async function savedSurvey(): Promise<SurveyData | null> {
    try {
      const order = await queryClient.fetchQuery({
        queryKey: orderKey(orderId),
        queryFn: () => fetchOrder(orderId),
        staleTime: 0,
      });
      return order.survey;
    } catch {
      return null;
    }
  }

  async function run(rating: number, comment: string): Promise<void> {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    try {
      const saved = await requestJson<{
        rating: number;
        comment: string | null;
        createdAt: string;
      }>(`/api/orders/${encodeURIComponent(orderId)}/survey`, {
        method: 'POST',
        body: surveyBody(rating, comment),
        handleUnauthorized: true,
      });
      const survey: SurveyData = {
        rating: saved.rating,
        comment: saved.comment,
        createdAt: saved.createdAt,
      };
      store(survey);
      latest.current.onDone?.(survey, 'sent');
    } catch (error) {
      const described = describeSurveyError(error);
      if (described.kind === 'already') {
        const survey = await savedSurvey();
        if (survey) {
          void queryClient.invalidateQueries({ queryKey: ['orders'] });
          latest.current.onDone?.(survey, 'already');
          return;
        }
      }
      if (described.kind === 'ambiguous') {
        const survey = await savedSurvey();
        if (survey) {
          void queryClient.invalidateQueries({ queryKey: ['orders'] });
          latest.current.onDone?.(survey, 'recovered');
          return;
        }
        latest.current.onFail?.(described);
        return;
      }
      if (described.kind === 'state' || described.kind === 'missing')
        void queryClient.invalidateQueries({ queryKey: orderKey(orderId) });
      latest.current.onFail?.(described);
    } finally {
      busy.current = false;
      setPending(false);
    }
  }

  return { run, pending };
}
