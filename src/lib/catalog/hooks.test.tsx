import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { fakeCatalogBack } from '../../../tests/utils/catalog';
import type { CreateProductBody } from './schemas';
import type { Product } from './types';
import { catalogUrl, findBySku, useCatalog } from './use-catalog';
import {
  useCreateProduct,
  useDeleteProduct,
  useReplaceComponents,
  useSetStatus,
  useUpdateProduct,
} from './use-product-actions';

afterEach(() => vi.unstubAllGlobals());

function setup() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  const spy = vi.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper, spy };
}

const body: CreateProductBody = {
  sku: 'NEW-1',
  name: 'Nuevo',
  category: 'snack',
  price: 3000,
  cost: 1000,
};

async function productOf(
  back: ReturnType<typeof fakeCatalogBack>,
  sku: string,
) {
  const p = await findBySku(sku);
  return p as Product;
}

describe('catalogUrl / useCatalog', () => {
  it('arma page, limit, search, category y active', () => {
    expect(
      catalogUrl({
        page: 2,
        search: ' ana ',
        category: 'cafe',
        state: 'activos',
      }),
    ).toBe(
      '/api/products?page=2&limit=20&search=ana&category=cafe&active=true',
    );
    expect(
      catalogUrl({
        page: 1,
        search: '',
        category: 'todas',
        state: 'inactivos',
      }),
    ).toBe('/api/products?page=1&limit=20&active=false');
    expect(
      catalogUrl(
        { page: 1, search: '', category: 'todas', state: 'todos' },
        100,
      ),
    ).toBe('/api/products?page=1&limit=100');
  });

  it('consulta al servidor y conserva la lista anterior al cambiar', async () => {
    const back = fakeCatalogBack();
    const { wrapper } = setup();
    const { result, rerender } = renderHook(({ f }) => useCatalog(f), {
      wrapper,
      initialProps: {
        f: {
          page: 1,
          search: '',
          category: 'todas' as const,
          state: 'todos' as const,
        },
      },
    });
    await waitFor(() => expect(result.current.data?.total).toBe(23));
    back.state.listDelayMs = 50;
    rerender({
      f: { page: 1, search: 'espresso', category: 'todas', state: 'todos' },
    });
    expect(result.current.data?.total).toBe(23);
    expect(result.current.isPlaceholderData).toBe(true);
    await waitFor(() => expect(result.current.data?.total).toBe(1));
    expect(back.lists().at(-1)?.url).toContain('search=espresso');
  });
});

describe('useCreateProduct', () => {
  it('un solo POST con el cuerpo exacto aunque se pulse dos veces; invalida catálogo, productos y menú', async () => {
    const back = fakeCatalogBack();
    const { wrapper, spy } = setup();
    const onDone = vi.fn();
    const { result } = renderHook(() => useCreateProduct({ onDone }), {
      wrapper,
    });
    await act(async () => {
      void result.current.run(body);
      void result.current.run(body);
    });
    expect(back.posts()).toHaveLength(1);
    expect(back.posts()[0]?.body).toEqual(body);
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ sku: 'NEW-1' }),
      'sent',
    );
    const keys = spy.mock.calls.map((c) => JSON.stringify(c[0]?.queryKey));
    expect(keys).toEqual(
      expect.arrayContaining(['["catalog"]', '["products"]', '["menu"]']),
    );
  });

  it('SKU repetido: error duplicado y sin consultar', async () => {
    const back = fakeCatalogBack();
    const { wrapper } = setup();
    const onFail = vi.fn();
    const { result } = renderHook(() => useCreateProduct({ onFail }), {
      wrapper,
    });
    await act(async () => result.current.run({ ...body, sku: 'CAF-ESPR' }));
    expect(onFail).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'duplicate' }),
    );
    expect(back.lists()).toHaveLength(0);
  });

  it('corte de red con efecto: lo encuentra por SKU y lo da por creado, sin reintentar', async () => {
    const back = fakeCatalogBack({ post: 'network-saved' });
    const { wrapper } = setup();
    const onDone = vi.fn();
    const { result } = renderHook(() => useCreateProduct({ onDone }), {
      wrapper,
    });
    await act(async () => result.current.run(body));
    expect(back.posts()).toHaveLength(1);
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ sku: 'NEW-1' }),
      'recovered',
    );
  });

  it('corte de red sin efecto: avisa ambiguo y deja reintentar', async () => {
    const back = fakeCatalogBack({ post: 'network' });
    const { wrapper } = setup();
    const onFail = vi.fn();
    const { result } = renderHook(() => useCreateProduct({ onFail }), {
      wrapper,
    });
    await act(async () => result.current.run(body));
    expect(onFail).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'ambiguous' }),
    );
    expect(back.posts()).toHaveLength(1);
    expect(result.current.pending).toBe(false);
  });
});

describe('useUpdateProduct', () => {
  it('PATCH con solo lo modificado; tras corte con efecto lo confirma comparando', async () => {
    const back = fakeCatalogBack({ patch: 'network-saved' });
    const { wrapper } = setup();
    const onDone = vi.fn();
    const { result } = renderHook(() => useUpdateProduct({ onDone }), {
      wrapper,
    });
    const product = await productOf(back, 'CAF-ESPR');
    await act(async () =>
      result.current.run({ product, body: { price: 3300 } }),
    );
    expect(back.patches()[0]?.body).toEqual({ price: 3300 });
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ price: 3300 }),
      'recovered',
    );
  });
});

describe('useReplaceComponents / useSetStatus / useDeleteProduct', () => {
  it('PUT reemplaza la composición y no toca el precio', async () => {
    const back = fakeCatalogBack();
    const { wrapper } = setup();
    const onDone = vi.fn();
    const { result } = renderHook(() => useReplaceComponents({ onDone }), {
      wrapper,
    });
    const product = await productOf(back, 'CMB-CLAS');
    const components = [
      { productId: back.idOf('CAF-ESPR'), quantity: 1 },
      { productId: back.idOf('PAS-BROW'), quantity: 2 },
    ];
    await act(async () => result.current.run({ product, components }));
    expect(back.puts()[0]?.body).toEqual({ components });
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ price: 6500 }),
      'sent',
    );
  });

  it('un componente inactivo da 400 con el texto del back', async () => {
    const back = fakeCatalogBack();
    back.store.setActive('PAN-PAND', false);
    const { wrapper } = setup();
    const onFail = vi.fn();
    const { result } = renderHook(() => useReplaceComponents({ onFail }), {
      wrapper,
    });
    const product = await productOf(back, 'CMB-CLAS');
    await act(async () =>
      result.current.run({
        product,
        components: [
          { productId: back.idOf('CAF-ESPR'), quantity: 1 },
          { productId: back.idOf('PAN-PAND'), quantity: 1 },
        ],
      }),
    );
    expect(onFail.mock.calls[0]?.[0].fields.components).toBe(
      'El componente PAN-PAND está inactivo.',
    );
  });

  it('estado: PATCH {active}; tras corte con efecto se confirma', async () => {
    const back = fakeCatalogBack({ status: 'network-saved' });
    const { wrapper } = setup();
    const onDone = vi.fn();
    const { result } = renderHook(() => useSetStatus({ onDone }), { wrapper });
    const product = await productOf(back, 'CAF-ESPR');
    await act(async () => result.current.run({ product, active: false }));
    expect(back.statuses()[0]?.body).toEqual({ active: false });
    expect(onDone).toHaveBeenCalledWith(
      expect.objectContaining({ active: false }),
      'recovered',
    );
  });

  it('eliminar: 409 por componente se explica; libre se borra; corte con efecto se confirma', async () => {
    const back = fakeCatalogBack();
    const { wrapper } = setup();
    const onFail = vi.fn();
    const onDone = vi.fn();
    const { result } = renderHook(() => useDeleteProduct({ onFail, onDone }), {
      wrapper,
    });
    const comp = await productOf(back, 'CAF-CAPU');
    await act(async () => result.current.run(comp));
    expect(onFail.mock.calls[0]?.[0]).toMatchObject({
      kind: 'conflict',
      messages: ['El producto es componente de un combo.'],
    });
    back.store.createProduct({ ...body });
    const fresh = await productOf(back, 'NEW-1');
    await act(async () => result.current.run(fresh));
    expect(onDone).toHaveBeenCalledWith(null, 'sent');

    back.state.del = 'network-saved';
    back.store.createProduct({ ...body, sku: 'NEW-2' });
    const second = await productOf(back, 'NEW-2');
    await act(async () => result.current.run(second));
    expect(onDone).toHaveBeenLastCalledWith(null, 'recovered');
  });
});
