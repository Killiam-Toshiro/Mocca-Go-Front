import { afterEach, describe, expect, it, vi } from 'vitest';
import { createInsightsStore } from '../../../tests/mock-api/insights';
import { jsonResponse } from '../../../tests/utils/render';
import { readXlsx } from '../../../tests/utils/xlsx';
import { isApiError } from '@/lib/api/errors';
import { exportSurveys } from './export-surveys';

const store = createInsightsStore(() => [
  { id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', name: 'Zona 1' },
  { id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Zona 2' },
]);
const NOW = Date.parse('2026-11-12T20:30:00Z');
const none = { rating: null, from: null, to: null };

function stub(over?: (url: URL, call: number) => Response | null) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input), 'http://x');
      calls.push(url.search);
      const custom = over?.(url, calls.length);
      if (custom) return custom;
      const r = store.surveys(url.searchParams);
      return jsonResponse(r.body, r.status);
    }),
  );
  return calls;
}
/** Back con `n` respuestas, paginadas de verdad (para probar varias páginas de 100). */
function bigStub(n: number, failCall = 0) {
  const calls: string[] = [];
  const rows = Array.from({ length: n }, (_, i) => ({
    orderId: `${String(i).padStart(8, '0')}-0000-4000-8000-000000000000`,
    rating: (i % 5) + 1,
    comment: null,
    createdAt: new Date(
      Date.parse('2026-11-10T15:00:00Z') - i * 60_000,
    ).toISOString(),
    number: 5000 + i,
    customer: { name: 'Ana' },
    zoneName: 'Zona 1',
  }));
  vi.stubGlobal(
    'fetch',
    vi.fn<typeof fetch>(async (input) => {
      const url = new URL(String(input), 'http://x');
      calls.push(url.search);
      if (calls.length === failCall)
        return jsonResponse(
          { statusCode: 403, message: 'Forbidden resource' },
          403,
        );
      const page = Number(url.searchParams.get('page'));
      const limit = Number(url.searchParams.get('limit'));
      return jsonResponse({
        page,
        limit,
        total: n,
        totalPages: Math.ceil(n / limit),
        data: rows.slice((page - 1) * limit, page * limit),
      });
    }),
  );
  return calls;
}

function saver() {
  const saved: { blob: Blob; name: string }[] = [];
  return {
    saved,
    save: (blob: Blob, name: string) => void saved.push({ blob, name }),
  };
}
const total = (rating?: number) =>
  (
    store.surveys(
      new URLSearchParams(
        rating ? { rating: String(rating), limit: '1' } : { limit: '1' },
      ),
    ).body as { total: number }
  ).total;

afterEach(() => vi.unstubAllGlobals());

describe('exportar encuestas a Excel', () => {
  it('trae TODAS las respuestas del filtro (varias páginas de 100) y lo dice en «Filtros»', async () => {
    const calls = stub();
    const { saved, save } = saver();
    const progress: number[][] = [];
    const name = await exportSurveys(none, {
      save,
      now: NOW,
      onProgress: (d, t) => progress.push([d, t]),
    });
    expect(name).toBe('mocca-go-encuestas_2026-11-12.xlsx');
    expect(
      calls.every((c) => new URLSearchParams(c).get('limit') === '100'),
    ).toBe(true);
    expect(saved).toHaveLength(1);
    const book = await readXlsx(saved[0]!.blob);
    const sheet = book.getWorksheet('Encuestas')!;
    expect(sheet.rowCount).toBe(1 + total());
    expect(sheet.getRow(1).values).toEqual([
      undefined,
      'Fecha y hora (Colombia)',
      'Pedido',
      'Cliente',
      'Zona',
      'Calificación',
      'Comentario',
    ]);
    expect(typeof sheet.getCell('E2').value).toBe('number');
    expect(sheet.getCell('A2').value).toBeInstanceOf(Date);
    const numbers = new Set<unknown>();
    sheet.eachRow((r, i) => i > 1 && numbers.add(r.getCell(2).value));
    expect(numbers.size).toBe(total());
    expect(progress.at(-1)).toEqual([total(), total()]);
    const filtros = book.getWorksheet('Filtros')!;
    const get = (label: string) => {
      let v: unknown;
      filtros.eachRow((r) => {
        if (r.getCell(1).value === label) v = r.getCell(2).value;
      });
      return v;
    };
    expect(get('Calificación')).toBe('Todas');
    expect(get('Respuestas que cumplen el filtro')).toBe(total());
    expect(get('Respuestas en el archivo')).toBe(total());
  });

  it('respeta los filtros de calificación y fechas', async () => {
    const calls = stub();
    const { saved, save } = saver();
    await exportSurveys(
      { rating: 5, from: '2026-10-01', to: '2026-11-30' },
      { save, now: NOW },
    );
    expect(calls[0]).toContain('rating=5');
    expect(calls[0]).toContain('from=2026-10-01');
    const book = await readXlsx(saved[0]!.blob);
    const sheet = book.getWorksheet('Encuestas')!;
    sheet.eachRow((r, i) => i > 1 && expect(r.getCell(5).value).toBe(5));
    expect(book.getWorksheet('Filtros')!.getCell('B2').value).toBe('5');
  });

  it('250 respuestas = 3 páginas de 100, todas en el archivo', async () => {
    const calls = bigStub(250);
    const { saved, save } = saver();
    const progress: number[][] = [];
    await exportSurveys(none, {
      save,
      now: NOW,
      onProgress: (d, t) => progress.push([d, t]),
    });
    expect(calls.map((c) => new URLSearchParams(c).get('page'))).toEqual([
      '1',
      '2',
      '3',
    ]);
    expect(
      (await readXlsx(saved[0]!.blob)).getWorksheet('Encuestas')!.rowCount,
    ).toBe(251);
    expect(progress).toEqual([
      [100, 250],
      [200, 250],
      [250, 250],
    ]);
  });

  it('tope: trae las más recientes y avisa en la hoja «Filtros»', async () => {
    const calls = bigStub(250);
    const { saved, save } = saver();
    await exportSurveys(none, { save, now: NOW, cap: 120 });
    expect(calls).toHaveLength(2);
    const book = await readXlsx(saved[0]!.blob);
    expect(book.getWorksheet('Encuestas')!.rowCount).toBe(121);
    expect(book.getWorksheet('Encuestas')!.getCell('B2').value).toBe(5000);
    let aviso = '';
    book.getWorksheet('Filtros')!.eachRow((r) => {
      if (r.getCell(1).value === 'Aviso') aviso = String(r.getCell(2).value);
    });
    expect(aviso).toContain('tope de 120');
  });

  it('un comentario con fórmula, y un cliente con fórmula, quedan como texto', async () => {
    const row = (n: number, comment: string | null, customer: string) => ({
      orderId: `0000000${String(n)}-0000-4000-8000-000000000000`,
      rating: 3,
      comment,
      createdAt: '2026-11-10T15:00:00.000Z',
      number: 2000 + n,
      customer: { name: customer },
      zoneName: 'Zona 1',
    });
    stub(() =>
      jsonResponse({
        page: 1,
        limit: 100,
        total: 2,
        totalPages: 1,
        data: [
          row(1, '=HYPERLINK("http://malo","clic")', '@admin'),
          row(2, null, 'Ana'),
        ],
      }),
    );
    const { saved, save } = saver();
    await exportSurveys(none, { save, now: NOW });
    const sheet = (await readXlsx(saved[0]!.blob)).getWorksheet('Encuestas')!;
    expect(sheet.getCell('F2').value).toBe(`'=HYPERLINK("http://malo","clic")`);
    expect(sheet.getCell('C2').value).toBe("'@admin");
    expect(sheet.getCell('F3').value).toBeNull();
  });

  it('no repite respuestas si llegan nuevas mientras se pagina', async () => {
    const dup = (id: string, n: number) => ({
      orderId: id,
      rating: 4,
      comment: null,
      createdAt: '2026-11-10T15:00:00.000Z',
      number: n,
      customer: { name: 'Ana' },
      zoneName: 'Zona 1',
    });
    const a = '00000001-0000-4000-8000-000000000000';
    const b = '00000002-0000-4000-8000-000000000000';
    stub((url) =>
      url.searchParams.get('page') === '1'
        ? jsonResponse({
            page: 1,
            limit: 100,
            total: 2,
            totalPages: 2,
            data: [dup(a, 1)],
          })
        : jsonResponse({
            page: 2,
            limit: 100,
            total: 2,
            totalPages: 2,
            data: [dup(a, 1), dup(b, 2)],
          }),
    );
    const { saved, save } = saver();
    await exportSurveys(none, { save, now: NOW });
    expect(
      (await readXlsx(saved[0]!.blob)).getWorksheet('Encuestas')!.rowCount,
    ).toBe(3);
  });

  it('un error en una página se explica y no se descarga nada', async () => {
    bigStub(250, 2);
    const { saved, save } = saver();
    const failure = await exportSurveys(none, { save, now: NOW }).catch(
      (e: unknown) => e,
    );
    expect(isApiError(failure)).toBe(true);
    expect(saved).toHaveLength(0);
  });

  it('cancelar a mitad no descarga nada', async () => {
    const abort = new AbortController();
    bigStub(250);
    const { saved, save } = saver();
    const result = exportSurveys(none, {
      save,
      now: NOW,
      signal: abort.signal,
      onProgress: () => abort.abort(),
    }).catch((e: unknown) => e);
    const failure = await result;
    expect((failure as Error).name).toBe('AbortError');
    expect(saved).toHaveLength(0);
  });

  it('sin respuestas: archivo con solo los encabezados', async () => {
    stub(() =>
      jsonResponse({ page: 1, limit: 100, total: 0, totalPages: 0, data: [] }),
    );
    const { saved, save } = saver();
    await exportSurveys(
      { rating: 2, from: null, to: null },
      { save, now: NOW },
    );
    expect(
      (await readXlsx(saved[0]!.blob)).getWorksheet('Encuestas')!.rowCount,
    ).toBe(1);
  });
});
