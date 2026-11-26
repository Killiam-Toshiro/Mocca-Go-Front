import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeSurveyBack, surveyOrder } from '../../../tests/utils/survey';
import { useSubmitSurvey } from './use-submit-survey';

afterEach(() => vi.unstubAllGlobals());

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  client.setQueryData(['order', 'o1'], surveyOrder());
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

function hook(handlers = {}) {
  const { client, wrapper } = setup();
  const onDone = vi.fn();
  const onFail = vi.fn();
  const view = renderHook(
    () => useSubmitSurvey('o1', { onDone, onFail, ...handlers }),
    { wrapper },
  );
  return { client, view, onDone, onFail };
}

describe('useSubmitSurvey', () => {
  it('envía { rating } o { rating, comment } y escribe la respuesta en el pedido', async () => {
    const back = fakeSurveyBack(surveyOrder());
    const { client, view, onDone } = hook();
    await act(() => view.result.current.run(4, '  Rico  '));
    expect(back.posts()).toHaveLength(1);
    expect(back.posts()[0]).toMatchObject({
      url: '/api/orders/o1/survey',
      body: { rating: 4, comment: 'Rico' },
    });
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ rating: 4, comment: 'Rico' }),
      'sent',
    );
    expect(
      client.getQueryData<{ survey: { rating: number } }>(['order', 'o1'])
        ?.survey.rating,
    ).toBe(4);
    await act(() => view.result.current.run(5, ''));
    expect(back.posts()[1]?.body).toEqual({ rating: 5 });
  });

  it('el doble clic envía una sola vez', async () => {
    const back = fakeSurveyBack(surveyOrder());
    const { view } = hook();
    await act(async () => {
      void view.result.current.run(5, '');
      void view.result.current.run(5, '');
    });
    expect(back.posts()).toHaveLength(1);
  });

  it('409 «ya tiene respuesta»: consulta el pedido y entrega la guardada', async () => {
    fakeSurveyBack(surveyOrder(), 'already');
    const { view, onDone, onFail } = hook();
    await act(() => view.result.current.run(2, ''));
    expect(onFail).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ rating: 5 }),
      'already',
    );
  });

  it('corte de red con la respuesta guardada: la encuentra al consultar', async () => {
    const back = fakeSurveyBack(surveyOrder(), 'network-saved');
    const { view, onDone, onFail } = hook();
    await act(() => view.result.current.run(3, 'ok'));
    expect(onFail).not.toHaveBeenCalled();
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ rating: 3 }),
      'recovered',
    );
    expect(back.posts()).toHaveLength(1);
  });

  it('corte de red sin guardar: no reintenta solo y avisa que se puede reintentar', async () => {
    const back = fakeSurveyBack(surveyOrder(), 'network');
    const { view, onDone, onFail } = hook();
    await act(() => view.result.current.run(3, ''));
    expect(onDone).not.toHaveBeenCalled();
    expect(onFail).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'ambiguous' }),
    );
    expect(back.posts()).toHaveLength(1);
    await waitFor(() => expect(view.result.current.pending).toBe(false));
  });

  it('409 de estado y 404: avisan y vuelven a consultar el pedido', async () => {
    const back = fakeSurveyBack(surveyOrder(), {
      status: 409,
      message:
        'El pedido #1001 está en estado «en_camino»; la encuesta se responde cuando está «entregado».',
    });
    const { client, view, onFail } = hook();
    const spy = vi.spyOn(client, 'invalidateQueries');
    await act(() => view.result.current.run(3, ''));
    expect(onFail).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'state' }),
    );
    expect(spy).toHaveBeenCalledWith({ queryKey: ['order', 'o1'] });
    back.state.behavior = { status: 404, message: 'Pedido no encontrado.' };
    await act(() => view.result.current.run(3, ''));
    expect(onFail).toHaveBeenLastCalledWith(
      expect.objectContaining({ kind: 'missing' }),
    );
  });

  it('400 se muestra tal cual, sin consultar', async () => {
    const back = fakeSurveyBack(surveyOrder(), {
      status: 400,
      message: 'comment debe tener entre 1 y 300 caracteres',
    });
    const { view, onFail } = hook();
    await act(() => view.result.current.run(3, 'x'));
    expect(onFail).toHaveBeenCalledWith({
      kind: 'validation',
      messages: ['comment debe tener entre 1 y 300 caracteres'],
    });
    expect(back.calls.filter((c) => c.method === 'GET')).toHaveLength(0);
  });
});
