import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInsightsStore } from '../../../tests/mock-api/insights';
import { jsonResponse, renderWithQuery } from '../../../tests/utils/render';
import {
  urlMock,
  useMockRouter,
  useMockSearchParams,
} from '../../../tests/utils/url';
import { downloadBlob } from '@/lib/export/download';
import { SurveysView } from './surveys-view';

vi.mock('@/lib/export/download', () => ({ downloadBlob: vi.fn() }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => useMockSearchParams(),
  useRouter: () => useMockRouter(),
  usePathname: () => '/admin/encuestas',
}));

const insights = createInsightsStore(() => [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Zona 1' },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Zona 2' },
]);

function stubBack(over?: (url: URL) => Response | null) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input), 'http://x');
      calls.push(url.search);
      const custom = over?.(url);
      if (custom) return custom;
      const r = insights.surveys(url.searchParams);
      return jsonResponse(r.body, r.status);
    }),
  );
  return calls;
}

const rows = () =>
  within(screen.getByRole('list', { name: 'Respuestas' })).getAllByRole(
    'listitem',
  );

beforeEach(() => {
  urlMock.reset();
  vi.mocked(downloadBlob).mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe('SurveysView', () => {
  it('lista respuestas con número, cliente, zona, «N de 5» y enlace al pedido', async () => {
    const calls = stubBack();
    renderWithQuery(<SurveysView />);
    await screen.findByRole('list', { name: 'Respuestas' });
    const items = rows();
    expect(items).toHaveLength(20);
    expect(new URLSearchParams(calls[0]).get('limit')).toBe('20');
    const first = items[0]!;
    expect(
      within(first)
        .getByRole('link', { name: /Pedido #\d+/ })
        .getAttribute('href'),
    ).toMatch(/^\/admin\/pedidos\/[0-9a-f-]{36}$/);
    expect(within(first).getByText(/\d de 5/)).toBeInTheDocument();
    expect(screen.getByText(/respuestas$/)).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /métricas del mismo periodo/ }),
    ).toHaveAttribute('href', '/admin/metricas');
  });

  it('el comentario es texto plano (sin HTML) y conserva los saltos de línea', async () => {
    stubBack((url) =>
      url.pathname === '/api/surveys'
        ? jsonResponse({
            page: 1,
            limit: 20,
            total: 2,
            totalPages: 1,
            data: [
              {
                orderId: '11111111-1111-4111-8111-111111111111',
                rating: 1,
                comment: '<img src=x onerror=alert(1)>\nSegunda línea',
                createdAt: '2026-11-10T15:00:00.000Z',
                number: 1050,
                customer: { name: 'Ana Pérez' },
                zoneName: 'Zona 1',
              },
              {
                orderId: '22222222-2222-4222-8222-222222222222',
                rating: 5,
                comment: null,
                createdAt: '2026-11-09T15:00:00.000Z',
                number: 1049,
                customer: { name: 'Luis Gómez' },
                zoneName: 'Zona 2',
              },
            ],
          })
        : null,
    );
    const { container } = renderWithQuery(<SurveysView />);
    expect(await screen.findByText(/Segunda línea/)).toHaveTextContent(
      '<img src=x onerror=alert(1)>',
    );
    expect(container.querySelector('img')).toBeNull();
    expect(screen.getByText('Sin comentario')).toBeInTheDocument();
    expect(screen.getByText('1 de 5')).toBeInTheDocument();
    expect(screen.getByText('2 respuestas')).toBeInTheDocument();
  });

  it('filtrar por calificación va a la URL y al back; «Quitar filtros» los limpia', async () => {
    const calls = stubBack();
    renderWithQuery(<SurveysView />);
    await screen.findAllByRole('listitem');
    await userEvent.selectOptions(screen.getByLabelText('Calificación'), '5');
    expect(urlMock.current()).toBe('rating=5');
    await waitFor(() => expect(calls.at(-1)).toContain('rating=5'));
    await waitFor(() => {
      for (const li of rows())
        expect(within(li).getByText('5 de 5')).toBeInTheDocument();
    });
    await userEvent.click(
      screen.getByRole('button', { name: 'Quitar filtros' }),
    );
    expect(urlMock.current()).toBe('');
    expect(
      screen.queryByRole('button', { name: 'Quitar filtros' }),
    ).not.toBeInTheDocument();
  });

  it('las fechas van a la URL y alimentan el enlace a métricas', async () => {
    urlMock.reset('from=2026-10-01&to=2026-10-31');
    const calls = stubBack();
    renderWithQuery(<SurveysView />);
    await screen.findByText(/respuestas?$/);
    expect(calls[0]).toContain('from=2026-10-01');
    expect(calls[0]).toContain('to=2026-10-31');
    expect(
      screen.getByRole('link', { name: /métricas del mismo periodo/ }),
    ).toHaveAttribute('href', '/admin/metricas?from=2026-10-01&to=2026-10-31');
  });

  it('fechas invertidas: aviso y no se consulta', async () => {
    urlMock.reset('from=2026-10-31&to=2026-10-01');
    const calls = stubBack();
    renderWithQuery(<SurveysView />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/posterior/);
    expect(calls).toHaveLength(0);
  });

  it('pagina: la página va a la URL y cambiar un filtro vuelve a la 1', async () => {
    const calls = stubBack();
    renderWithQuery(<SurveysView />);
    await screen.findAllByRole('listitem');
    await userEvent.click(screen.getByRole('button', { name: /Siguiente/ }));
    expect(urlMock.current()).toBe('page=2');
    await waitFor(() => expect(calls.at(-1)).toContain('page=2'));
    await userEvent.selectOptions(screen.getByLabelText('Calificación'), '4');
    expect(urlMock.current()).toBe('rating=4');
  });

  it('vacío con y sin filtros, y error con «Reintentar»', async () => {
    stubBack(() =>
      jsonResponse({ page: 1, limit: 20, total: 0, totalPages: 0, data: [] }),
    );
    const first = renderWithQuery(<SurveysView />);
    expect(
      await screen.findByText('Aún no hay respuestas de clientes.'),
    ).toBeInTheDocument();
    first.unmount();
    urlMock.reset('rating=2');
    renderWithQuery(<SurveysView />);
    expect(
      await screen.findByText('No hay respuestas con estos filtros.'),
    ).toBeInTheDocument();
    vi.unstubAllGlobals();
    stubBack(() =>
      jsonResponse({ statusCode: 403, message: 'Forbidden resource' }, 403),
    );
  });

  it('error del back: se muestra y «Reintentar» vuelve a pedir', async () => {
    let fail = true;
    stubBack(() =>
      fail
        ? jsonResponse({ statusCode: 403, message: 'Forbidden resource' }, 403)
        : null,
    );
    renderWithQuery(<SurveysView />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    fail = false;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect((await screen.findAllByRole('listitem')).length).toBeGreaterThan(0);
  });

  it('«Descargar Excel» baja todas las respuestas con los filtros de la URL', async () => {
    urlMock.reset('rating=5');
    const calls = stubBack();
    renderWithQuery(<SurveysView />);
    await screen.findByRole('list', { name: 'Respuestas' });
    await userEvent.click(
      screen.getByRole('button', { name: 'Descargar Excel' }),
    );
    expect(
      await screen.findByText(/Descargado: mocca-go-encuestas_/),
    ).toBeInTheDocument();
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const exportCall = calls.find((c) => c.includes('limit=100'))!;
    expect(exportCall).toContain('rating=5');
  });

  it('sin respuestas no se ofrece descargar', async () => {
    stubBack(() =>
      jsonResponse({ page: 1, limit: 20, total: 0, totalPages: 0, data: [] }),
    );
    renderWithQuery(<SurveysView />);
    await screen.findByText('Aún no hay respuestas de clientes.');
    expect(
      screen.queryByRole('button', { name: 'Descargar Excel' }),
    ).not.toBeInTheDocument();
  });

  it('cancelar a mitad no descarga nada y se dice', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>(
        (input, init) =>
          new Promise<Response>((resolve, reject) => {
            const url = new URL(String(input), 'http://x');
            if (url.searchParams.get('limit') === '100') {
              init?.signal?.addEventListener('abort', () =>
                reject(init.signal?.reason),
              );
              return;
            }
            const r = insights.surveys(url.searchParams);
            resolve(jsonResponse(r.body, r.status));
          }),
      ),
    );
    renderWithQuery(<SurveysView />);
    await screen.findByRole('list', { name: 'Respuestas' });
    await userEvent.click(
      screen.getByRole('button', { name: 'Descargar Excel' }),
    );
    expect(
      await screen.findByRole('button', { name: 'Preparando…' }),
    ).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(
      await screen.findByText(/Exportación cancelada. No se descargó nada./),
    ).toBeInTheDocument();
    expect(downloadBlob).not.toHaveBeenCalled();
    expect(
      screen.getByRole('button', { name: 'Descargar Excel' }),
    ).toBeEnabled();
  });

  it('un error al exportar se explica y no se descarga un archivo incompleto', async () => {
    stubBack((url) =>
      url.searchParams.get('limit') === '100'
        ? jsonResponse({ statusCode: 403, message: 'Forbidden resource' }, 403)
        : null,
    );
    renderWithQuery(<SurveysView />);
    await screen.findByRole('list', { name: 'Respuestas' });
    await userEvent.click(
      screen.getByRole('button', { name: 'Descargar Excel' }),
    );
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(downloadBlob).not.toHaveBeenCalled();
  });
});
