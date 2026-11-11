import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithQuery } from '../../../tests/utils/render';
import { fakeSurveyBack, surveyOrder } from '../../../tests/utils/survey';
import { OrderDetailView } from '@/components/orders/order-detail-view';

afterEach(() => vi.unstubAllGlobals());

const stars = (name: string) => screen.findByRole('radio', { name });
const send = () =>
  screen.getByRole('button', { name: /Enviar calificación|Reintentar/ });

describe('encuesta en el detalle del pedido', () => {
  it('solo aparece con el pedido entregado y sin respuesta', async () => {
    fakeSurveyBack(surveyOrder({ status: 'en_camino' }));
    renderWithQuery(<OrderDetailView id="o1" />);
    await screen.findByRole('heading', { level: 1 });
    expect(screen.queryByText('¿Qué tal estuvo tu pedido?')).toBeNull();
    expect(screen.queryByText('Tu calificación')).toBeNull();
  });

  it('con la encuesta respondida muestra «Tu calificación» de solo lectura', async () => {
    fakeSurveyBack(
      surveyOrder({
        survey: {
          rating: 4,
          comment: 'Llegó caliente',
          createdAt: '2026-11-11T18:00:00Z',
        },
      }),
    );
    renderWithQuery(<OrderDetailView id="o1" />);
    expect(
      await screen.findByRole('heading', { name: 'Tu calificación' }),
    ).toBeInTheDocument();
    expect(screen.getByText('4 de 5 · Buena')).toBeInTheDocument();
    expect(screen.getByText('Llegó caliente')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Enviar/ })).toBeNull();
  });

  it('exige una estrella, avisa que no se puede cambiar y cuenta el comentario', async () => {
    fakeSurveyBack(surveyOrder());
    renderWithQuery(<OrderDetailView id="o1" />);
    expect(
      await screen.findByText('¿Qué tal estuvo tu pedido?'),
    ).toBeInTheDocument();
    expect(send()).toBeDisabled();
    expect(
      screen.getByText('Al enviarla no podrás cambiarla.'),
    ).toBeInTheDocument();
    await userEvent.type(
      screen.getByLabelText('Comentario (opcional)'),
      'Rico',
    );
    expect(screen.getByText('4/300')).toBeInTheDocument();
    await userEvent.click(await stars('5 de 5 · Excelente'));
    expect(send()).toBeEnabled();
  });

  it('envía, pasa a «Tu calificación» y deja el foco en su título', async () => {
    const back = fakeSurveyBack(surveyOrder());
    renderWithQuery(<OrderDetailView id="o1" />);
    await userEvent.click(await stars('5 de 5 · Excelente'));
    await userEvent.type(
      screen.getByLabelText('Comentario (opcional)'),
      '  Rico ',
    );
    await userEvent.click(send());
    const title = await screen.findByRole('heading', {
      name: 'Tu calificación',
    });
    await waitFor(() => expect(title).toHaveFocus());
    expect(back.posts()).toHaveLength(1);
    expect(back.posts()[0]?.body).toEqual({ rating: 5, comment: 'Rico' });
    expect(screen.getByText('Rico')).toBeInTheDocument();
  });

  it('doble clic = un solo envío', async () => {
    const back = fakeSurveyBack(surveyOrder());
    renderWithQuery(<OrderDetailView id="o1" />);
    await userEvent.click(await stars('3 de 5 · Regular'));
    const button = send();
    // Dos clics seguidos, antes de que React pinte «Enviando…»: solo el primero envía.
    fireEvent.click(button);
    fireEvent.click(button);
    await screen.findByRole('heading', { name: 'Tu calificación' });
    expect(back.posts()).toHaveLength(1);
  });

  it('409 «ya tiene respuesta»: avisa y muestra la guardada', async () => {
    fakeSurveyBack(surveyOrder(), 'already');
    renderWithQuery(<OrderDetailView id="o1" />);
    await userEvent.click(await stars('2 de 5 · Mala'));
    await userEvent.click(send());
    expect(
      await screen.findByText(/ya tenía una calificación/),
    ).toBeInTheDocument();
    expect(screen.getByText('5 de 5 · Excelente')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByText(/ya tenía una calificación/)).toBeNull();
  });

  it('409 de estado: aviso «Entendido» aunque el formulario desaparezca', async () => {
    const back = fakeSurveyBack(surveyOrder(), {
      status: 409,
      message:
        'El pedido #1001 está en estado «en_camino»; la encuesta se responde cuando está «entregado».',
    });
    renderWithQuery(<OrderDetailView id="o1" />);
    await userEvent.click(await stars('2 de 5 · Mala'));
    back.state.order = surveyOrder({ status: 'en_camino' });
    await userEvent.click(send());
    expect(
      await screen.findByText(/solo se califica cuando está entregado/),
    ).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText('¿Qué tal estuvo tu pedido?')).toBeNull(),
    );
    expect(
      screen.getByRole('button', { name: 'Entendido' }),
    ).toBeInTheDocument();
  });

  it('corte de red sin guardar: conserva lo escrito y ofrece «Reintentar»; no reintenta solo', async () => {
    const back = fakeSurveyBack(surveyOrder(), 'network');
    renderWithQuery(<OrderDetailView id="o1" />);
    await userEvent.click(await stars('4 de 5 · Buena'));
    await userEvent.type(
      screen.getByLabelText('Comentario (opcional)'),
      'Bien',
    );
    await userEvent.click(send());
    expect(
      await screen.findByText(/No pudimos confirmar si se guardó/),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Comentario (opcional)')).toHaveValue('Bien');
    expect(back.posts()).toHaveLength(1);
    back.state.behavior = 'ok';
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    await screen.findByRole('heading', { name: 'Tu calificación' });
    expect(back.posts()).toHaveLength(2);
  });

  it('corte de red con la respuesta ya guardada: la muestra sin pedir reintento', async () => {
    fakeSurveyBack(surveyOrder(), 'network-saved');
    renderWithQuery(<OrderDetailView id="o1" />);
    await userEvent.click(await stars('4 de 5 · Buena'));
    await userEvent.click(send());
    expect(await screen.findByText('Tu calificación')).toBeInTheDocument();
    expect(screen.getByText(/sí se guardó/)).toBeInTheDocument();
  });

  it('anuncia en una región de estado cuando el pedido pasa a entregado (no en la carga)', async () => {
    const back = fakeSurveyBack(surveyOrder({ status: 'en_camino' }));
    const { client } = renderWithQuery(<OrderDetailView id="o1" />);
    await screen.findByRole('heading', { level: 1 });
    const region = document.querySelector('[role="status"].sr-only');
    expect(region).toHaveTextContent('');
    back.state.order = surveyOrder();
    await client.invalidateQueries({ queryKey: ['order', 'o1'] });
    await waitFor(() =>
      expect(region).toHaveTextContent(
        'Tu pedido #1001 fue entregado. ¡Cuéntanos qué tal estuvo!',
      ),
    );
    expect(document.activeElement).toBe(document.body);
  });
});
