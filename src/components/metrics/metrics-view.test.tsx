import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addDays, todayBogota } from '@/lib/metrics/period';
import { createInsightsStore } from '../../../tests/mock-api/insights';
import { createZonesStore } from '../../../tests/mock-api/zones';
import { jsonResponse, renderWithQuery } from '../../../tests/utils/render';
import {
  urlMock,
  useMockRouter,
  useMockSearchParams,
} from '../../../tests/utils/url';
import { downloadBlob } from '@/lib/export/download';
import { MetricsView } from './metrics-view';

vi.mock('@/lib/export/download', () => ({ downloadBlob: vi.fn() }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => useMockSearchParams(),
  useRouter: () => useMockRouter(),
  usePathname: () => '/admin/metricas',
}));
vi.mock('./charts', () => ({
  SalesChart: () => <div data-testid="sales-chart" />,
  RatingChart: () => <div data-testid="rating-chart" />,
  OutcomesChart: () => <div data-testid="outcomes-chart" />,
}));

const zonesStore = createZonesStore({
  usedPoint: () => false,
  usedZone: () => false,
});
const allZones = (
  zonesStore.allZones().body as {
    data: { id: string; name: string; active: boolean }[];
  }
).data;
const insights = createInsightsStore(() => allZones);

interface Backend {
  metricsCalls: string[];
  fail?: { status: number; message: string };
}
function stubBack(state: Backend = { metricsCalls: [] }) {
  const f = vi.fn<typeof fetch>(async (input) => {
    const url = new URL(String(input), 'http://x');
    if (url.pathname === '/api/delivery-zones/all')
      return jsonResponse({ data: allZones });
    if (url.pathname === '/api/metrics') {
      state.metricsCalls.push(url.search);
      if (state.fail)
        return jsonResponse(
          { statusCode: state.fail.status, message: state.fail.message },
          state.fail.status,
        );
      const r = insights.metrics(url.searchParams);
      return jsonResponse(r.body, r.status);
    }
    return jsonResponse({}, 404);
  });
  vi.stubGlobal('fetch', f);
  return state;
}

beforeEach(() => {
  urlMock.reset();
  vi.mocked(downloadBlob).mockClear();
});
afterEach(() => vi.unstubAllGlobals());

describe('MetricsView', () => {
  it('muestra las seis secciones con las cifras del back y tablas con los mismos datos', async () => {
    const back = stubBack();
    renderWithQuery(<MetricsView />);
    for (const name of [
      'Ventas',
      'Margen',
      'Entregas',
      'Satisfacción',
      'Recompra',
      'Resultado de los pedidos',
    ])
      expect(
        await screen.findByRole('heading', { level: 2, name }),
      ).toBeInTheDocument();
    expect(back.metricsCalls).toHaveLength(1);
    const q = new URLSearchParams(back.metricsCalls[0]);
    const today = todayBogota();
    expect(q.get('to')).toBe(today);
    expect(q.get('from')).toBe(addDays(today, -29));
    expect(screen.getByRole('button', { name: '30 días' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    const ventas = screen.getByRole('region', { name: 'Ventas' });
    expect(within(ventas).getByText('Ingresos')).toBeInTheDocument();
    expect(await screen.findByTestId('sales-chart')).toBeInTheDocument();
    expect(
      within(ventas).getByText('Ver ventas por día como tabla'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /Ver las encuestas/ }),
    ).toHaveAttribute(
      'href',
      `/admin/encuestas?from=${addDays(today, -29)}&to=${today}`,
    );
    expect(screen.getByText(/Consultado a las/)).toBeInTheDocument();
  });

  it('un atajo cambia el periodo en la URL y vuelve a consultar', async () => {
    const back = stubBack();
    renderWithQuery(<MetricsView />);
    await screen.findByRole('heading', { name: 'Ventas' });
    await userEvent.click(screen.getByRole('button', { name: '7 días' }));
    const today = todayBogota();
    expect(urlMock.current()).toBe(`from=${addDays(today, -6)}&to=${today}`);
    await waitFor(() => expect(back.metricsCalls).toHaveLength(2));
    expect(screen.getByRole('button', { name: '7 días' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('la zona filtra: manda zoneId y la tabla de entregas solo trae esa zona', async () => {
    const back = stubBack();
    renderWithQuery(<MetricsView />);
    await screen.findByRole('heading', { name: 'Ventas' });
    await screen.findByRole('option', { name: allZones[0]!.name });
    await userEvent.selectOptions(
      screen.getByLabelText('Zona'),
      allZones[0]!.id,
    );
    await waitFor(() =>
      expect(back.metricsCalls.at(-1)).toContain(`zoneId=${allZones[0]!.id}`),
    );
    const entregas = screen.getByRole('region', { name: 'Entregas' });
    await userEvent.click(within(entregas).getByText('Ver tiempos por zona'));
    await waitFor(() =>
      expect(within(entregas).getAllByRole('row')).toHaveLength(2),
    );
  });

  it('periodo personalizado inválido se explica y no consulta', async () => {
    const back = stubBack();
    renderWithQuery(<MetricsView />);
    await screen.findByRole('heading', { name: 'Ventas' });
    await userEvent.click(
      screen.getByRole('button', { name: 'Personalizado' }),
    );
    const from = screen.getByLabelText('Desde');
    const to = screen.getByLabelText('Hasta');
    await userEvent.clear(from);
    await userEvent.type(from, '2026-05-02');
    await userEvent.clear(to);
    await userEvent.type(to, '2026-05-01');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(/posterior/);
    expect(back.metricsCalls).toHaveLength(1);
    expect(urlMock.replaced).toHaveLength(0);
  });

  it('periodo personalizado válido va a la URL', async () => {
    const back = stubBack();
    renderWithQuery(<MetricsView />);
    await screen.findByRole('heading', { name: 'Ventas' });
    await userEvent.click(
      screen.getByRole('button', { name: 'Personalizado' }),
    );
    const from = screen.getByLabelText('Desde');
    const to = screen.getByLabelText('Hasta');
    await userEvent.clear(from);
    await userEvent.type(from, '2026-10-01');
    await userEvent.clear(to);
    await userEvent.type(to, '2026-10-10');
    await userEvent.click(screen.getByRole('button', { name: 'Aplicar' }));
    expect(urlMock.current()).toBe('from=2026-10-01&to=2026-10-10');
    await waitFor(() => expect(back.metricsCalls).toHaveLength(2));
    expect(
      screen.getByRole('button', { name: 'Personalizado' }),
    ).toHaveAttribute('aria-pressed', 'true');
  });

  it('periodo sin pedidos: «Sin datos», nunca 0 % ni gráficas vacías', async () => {
    urlMock.reset('from=2020-01-01&to=2020-01-31');
    stubBack();
    renderWithQuery(<MetricsView />);
    await screen.findByRole('heading', { name: 'Ventas' });
    expect(
      screen.getAllByText('Sin datos en este periodo').length,
    ).toBeGreaterThanOrEqual(3);
    expect(screen.queryByText('0 %')).not.toBeInTheDocument();
    expect(screen.queryByTestId('sales-chart')).not.toBeInTheDocument();
    expect(screen.queryByTestId('outcomes-chart')).not.toBeInTheDocument();
    const entregas = screen.getByRole('region', { name: 'Entregas' });
    expect(
      within(entregas).getByText('Entregados a tiempo').nextSibling,
    ).toHaveTextContent('Sin datos');
  });

  it('rango inválido en la URL: aviso y no se consulta', async () => {
    urlMock.reset('from=2026-10-10&to=2026-10-01');
    const back = stubBack();
    renderWithQuery(<MetricsView />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/posterior/);
    expect(back.metricsCalls).toHaveLength(0);
  });

  it('error del back: texto y «Reintentar» que vuelve a pedir', async () => {
    const back = stubBack();
    back.fail = { status: 403, message: 'Forbidden resource' };
    renderWithQuery(<MetricsView />);
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    back.fail = undefined;
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(
      await screen.findByRole('heading', { name: 'Ventas' }),
    ).toBeInTheDocument();
  });

  it('zona que ya no existe (404): se explica y «Entendido» quita el filtro', async () => {
    urlMock.reset('zoneId=cccccccc-cccc-4ccc-8ccc-cccccccccccc');
    stubBack();
    renderWithQuery(<MetricsView />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Zona no encontrada.',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(urlMock.current()).not.toContain('zoneId');
    expect(
      await screen.findByRole('heading', { name: 'Ventas' }),
    ).toBeInTheDocument();
  });

  it('«Actualizar» vuelve a consultar', async () => {
    const back = stubBack();
    renderWithQuery(<MetricsView />);
    await screen.findByRole('heading', { name: 'Ventas' });
    await userEvent.click(screen.getByRole('button', { name: 'Actualizar' }));
    await waitFor(() => expect(back.metricsCalls).toHaveLength(2));
  });

  it('«Descargar Excel» baja el archivo del periodo visible, una sola vez aunque se pulse dos veces', async () => {
    const back = stubBack();
    renderWithQuery(<MetricsView />);
    await screen.findByRole('heading', { name: 'Ventas' });
    const button = screen.getByRole('button', { name: 'Descargar Excel' });
    await userEvent.dblClick(button);
    expect(
      await screen.findByText(/Descargado: mocca-go-metricas_/),
    ).toBeInTheDocument();
    expect(downloadBlob).toHaveBeenCalledTimes(1);
    const [blob, name] = vi.mocked(downloadBlob).mock.calls[0]!;
    const today = todayBogota();
    expect(name).toBe(
      `mocca-go-metricas_${addDays(today, -29)}_a_${today}.xlsx`,
    );
    expect(blob.size).toBeGreaterThan(1000);
    expect(back.metricsCalls).toHaveLength(1);
    await userEvent.click(screen.getByRole('button', { name: 'Entendido' }));
    expect(screen.queryByText(/Descargado:/)).not.toBeInTheDocument();
  });

  it('con zona filtrada el archivo lleva la zona en el nombre', async () => {
    stubBack();
    renderWithQuery(<MetricsView />);
    await screen.findByRole('heading', { name: 'Ventas' });
    await screen.findByRole('option', { name: allZones[0]!.name });
    await userEvent.selectOptions(
      screen.getByLabelText('Zona'),
      allZones[0]!.id,
    );
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Descargar Excel' }),
      ).toBeEnabled(),
    );
    await userEvent.click(
      screen.getByRole('button', { name: 'Descargar Excel' }),
    );
    await screen.findByText(/Descargado:/);
    expect(vi.mocked(downloadBlob).mock.calls[0]![1]).toMatch(/_zona-1\.xlsx$/);
  });

  it('sin datos cargados (error de periodo) no hay botón de descarga', async () => {
    urlMock.reset('from=2026-10-10&to=2026-10-01');
    stubBack();
    renderWithQuery(<MetricsView />);
    await screen.findByRole('alert');
    expect(
      screen.queryByRole('button', { name: 'Descargar Excel' }),
    ).not.toBeInTheDocument();
  });
});
