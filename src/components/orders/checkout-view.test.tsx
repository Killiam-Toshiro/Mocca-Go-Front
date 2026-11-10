import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resetStorageForTests } from '@/lib/cart/storage';
import {
  addToCart,
  getSnapshot,
  resetCartStoreForTests,
} from '@/lib/cart/store';
import { resetSessionStoreForTests } from '@/lib/orders/session-store';
import { jsonResponse, renderWithQuery } from '../../../tests/utils/render';
import { CheckoutView } from './checkout-view';

const replace = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }));

const CAPU = {
  id: 'capu',
  sku: 'CAF-CAPU',
  name: 'Capuchino',
  description: null,
  category: 'cafe',
  price: 4500,
  available: true,
  components: [],
};
const ZONES = [
  {
    id: 'z1',
    name: 'Zona 1',
    points: [
      {
        id: 'p-pisos',
        name: 'Edificio A',
        hint: 'Plazoleta de auditorios',
        floors: 3,
      },
      { id: 'p-plano', name: 'Plazoleta', hint: null, floors: null },
    ],
  },
];
const ORDER = { id: 'o1', number: 1001, status: 'recibido' };

type Handler = (init: RequestInit) => Response | Promise<Response>;
let menu = [CAPU];
let post: ReturnType<typeof vi.fn<Handler>>;

function serve() {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string, init: RequestInit = {}) => {
      if (url === '/api/menu') return jsonResponse({ data: menu });
      if (url === '/api/delivery-zones') return jsonResponse({ data: ZONES });
      if (url === '/api/orders' && init.method === 'POST') return post(init);
      return jsonResponse({ message: 'x' }, 404);
    }),
  );
}
const posts = () =>
  (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.filter(
    (c) => (c as [string, RequestInit])[0] === '/api/orders',
  ) as [string, RequestInit][];
const key = (n = 0) =>
  (posts()[n]![1].headers as Record<string, string>)['idempotency-key'];

async function fill({
  point = 'p-plano',
  floor,
}: { point?: string; floor?: string } = {}) {
  await userEvent.selectOptions(await screen.findByLabelText('Zona'), 'z1');
  await userEvent.selectOptions(
    screen.getByLabelText('Punto de entrega'),
    point,
  );
  if (floor)
    await userEvent.selectOptions(screen.getByLabelText('Piso'), floor);
}
const card = (digits = '4242424242424242') =>
  userEvent.type(screen.getByLabelText('Número de tarjeta'), digits);
const pay = () =>
  userEvent.click(screen.getByRole('button', { name: /^Pagar/ }));

beforeEach(() => {
  replace.mockClear();
  menu = [CAPU];
  post = vi.fn<Handler>(async () => jsonResponse(ORDER, 201));
  window.localStorage.clear();
  window.sessionStorage.clear();
  resetStorageForTests();
  resetCartStoreForTests();
  resetSessionStoreForTests();
  addToCart({ id: 'capu', name: 'Capuchino', price: 4500 }, 2);
  serve();
});
afterEach(() => vi.unstubAllGlobals());

describe('CheckoutView', () => {
  it('con el carrito vacío vuelve al menú', async () => {
    resetCartStoreForTests();
    window.localStorage.clear();
    renderWithQuery(<CheckoutView />);
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/cliente/menu?vacio=1'),
    );
  });

  it('paga: envía clave, cuerpo exacto, vacía el carrito y va al detalle', async () => {
    renderWithQuery(<CheckoutView />);
    await fill({ point: 'p-pisos', floor: '2' });
    await userEvent.type(
      screen.getByLabelText(/Indicación de entrega/),
      ' Salón 302 ',
    );
    await card();
    expect(screen.getByLabelText('Número de tarjeta')).toHaveValue(
      '4242 4242 4242 4242',
    );
    await pay();
    await waitFor(() =>
      expect(replace).toHaveBeenCalledWith('/cliente/pedidos/o1?nuevo=1'),
    );
    const [, init] = posts()[0]!;
    expect(key()).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(JSON.parse(init.body as string)).toEqual({
      items: [{ productId: 'capu', quantity: 2 }],
      pointId: 'p-pisos',
      floor: 2,
      deliveryNote: 'Salón 302',
      payment: { method: 'tarjeta_demo', cardNumber: '4242424242424242' },
    });
    expect(getSnapshot().cart).toHaveLength(0);
  });

  it('un punto sin pisos no envía floor ni notas vacías', async () => {
    renderWithQuery(<CheckoutView />);
    await fill();
    await card();
    await pay();
    await waitFor(() => expect(posts()).toHaveLength(1));
    const body = JSON.parse(posts()[0]![1].body as string) as Record<
      string,
      unknown
    >;
    expect(body).not.toHaveProperty('floor');
    expect(body).not.toHaveProperty('note');
    expect(body).not.toHaveProperty('deliveryNote');
  });

  it('valida entrega, piso y tarjeta sin llamar al servidor', async () => {
    renderWithQuery(<CheckoutView />);
    await screen.findByLabelText('Zona');
    await pay();
    expect(await screen.findByText('Elige una zona.')).toBeInTheDocument();
    expect(screen.getByLabelText('Zona')).toHaveFocus();
    await fill({ point: 'p-pisos' });
    await pay();
    expect(screen.getByText('Elige un piso.')).toBeInTheDocument();
    await userEvent.selectOptions(screen.getByLabelText('Piso'), '1');
    await pay();
    expect(
      screen.getByText('Escribe los 16 dígitos de la tarjeta.'),
    ).toBeInTheDocument();
    expect(posts()).toHaveLength(0);
  });

  it('«Usar tarjeta de prueba» rellena la tarjeta aprobada', async () => {
    renderWithQuery(<CheckoutView />);
    await screen.findByLabelText('Zona');
    await userEvent.click(
      screen.getByRole('button', { name: 'Usar tarjeta de prueba' }),
    );
    expect(screen.getByLabelText('Número de tarjeta')).toHaveValue(
      '4242 4242 4242 4242',
    );
  });

  it('402: avisa junto a la tarjeta y conserva carrito y datos', async () => {
    post.mockImplementation(async () =>
      jsonResponse({ statusCode: 402, message: 'x' }, 402),
    );
    renderWithQuery(<CheckoutView />);
    await fill();
    await card('4000000000000002');
    await pay();
    expect(
      await screen.findByText('La tarjeta fue rechazada.'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Número de tarjeta')).toHaveFocus();
    expect(screen.getByLabelText('Punto de entrega')).toHaveValue('p-plano');
    expect(getSnapshot().cart).toHaveLength(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it('409: explica, refresca el menú y no pierde el carrito', async () => {
    post.mockImplementation(async () =>
      jsonResponse({ statusCode: 409, message: 'Capuchino está agotado' }, 409),
    );
    renderWithQuery(<CheckoutView />);
    await fill();
    await card();
    await pay();
    expect(
      await screen.findByText('Capuchino está agotado'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: 'Revisar mi carrito' }),
    ).toBeInTheDocument();
    expect(getSnapshot().cart).toHaveLength(1);
  });

  it('400 muestra los mensajes del back y 429 el aviso de espera', async () => {
    post.mockImplementationOnce(async () =>
      jsonResponse({ statusCode: 400, message: ['floor es obligatorio'] }, 400),
    );
    renderWithQuery(<CheckoutView />);
    await fill();
    await card();
    await pay();
    expect(await screen.findByText('floor es obligatorio')).toBeInTheDocument();
    post.mockImplementationOnce(async () =>
      jsonResponse({ statusCode: 429, message: 'x' }, 429),
    );
    await pay();
    expect(await screen.findByText(/Demasiados intentos/)).toBeInTheDocument();
  });

  it('un fallo de red se reintenta con la misma clave; si cambian los datos, clave nueva', async () => {
    post.mockImplementationOnce(async () =>
      jsonResponse({ statusCode: 502, message: 'x' }, 502),
    );
    renderWithQuery(<CheckoutView />);
    await fill();
    await card();
    await pay();
    expect(await screen.findByText(/No pudimos conectar/)).toBeInTheDocument();
    post.mockImplementationOnce(async () =>
      jsonResponse({ statusCode: 502, message: 'x' }, 502),
    );
    await pay();
    await waitFor(() => expect(posts()).toHaveLength(2));
    expect(key(1)).toBe(key(0));
    await userEvent.type(
      screen.getByLabelText(/Nota para la cocina/),
      'Sin azúcar',
    );
    post.mockImplementationOnce(async () =>
      jsonResponse({ statusCode: 502, message: 'x' }, 502),
    );
    await pay();
    await waitFor(() => expect(posts()).toHaveLength(3));
    expect(key(2)).not.toBe(key(0));
  });

  it('un doble clic envía una sola petición', async () => {
    let release: () => void = () => undefined;
    post.mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(jsonResponse(ORDER, 201));
        }),
    );
    renderWithQuery(<CheckoutView />);
    await fill();
    await card();
    const button = screen.getByRole('button', { name: /^Pagar/ });
    await userEvent.dblClick(button);
    expect(
      await screen.findByRole('button', { name: /Procesando/ }),
    ).toBeDisabled();
    expect(posts()).toHaveLength(1);
    release();
    await waitFor(() => expect(replace).toHaveBeenCalled());
  });

  it('el número de tarjeta no queda en ningún almacenamiento ni caché (CA-10)', async () => {
    const secret = '4242424242424242';
    const { client } = renderWithQuery(<CheckoutView />);
    await fill();
    await card(secret);
    await pay();
    await waitFor(() => expect(replace).toHaveBeenCalled());
    const dump = (s: Storage) =>
      JSON.stringify(Object.fromEntries(Object.entries(s)));
    expect(dump(window.localStorage)).not.toContain(secret);
    expect(dump(window.sessionStorage)).not.toContain(secret);
    expect(
      JSON.stringify(
        client
          .getQueryCache()
          .getAll()
          .map((q) => q.state.data),
      ),
    ).not.toContain(secret);
    expect(
      JSON.stringify(
        client
          .getMutationCache()
          .getAll()
          .map((m) => m.state.variables ?? null),
      ),
    ).not.toContain(secret);
  });

  it('recuerda punto y notas al volver, pero nunca la tarjeta', async () => {
    const first = renderWithQuery(<CheckoutView />);
    await fill();
    await userEvent.type(
      screen.getByLabelText(/Nota para la cocina/),
      'Sin azúcar',
    );
    await card();
    first.unmount();
    renderWithQuery(<CheckoutView />);
    await waitFor(() =>
      expect(screen.getByLabelText('Punto de entrega')).toHaveValue('p-plano'),
    );
    expect(screen.getByLabelText(/Nota para la cocina/)).toHaveValue(
      'Sin azúcar',
    );
    expect(screen.getByLabelText('Número de tarjeta')).toHaveValue('');
  });

  it('con un producto agotado no se puede pagar', async () => {
    menu = [{ ...CAPU, available: false }];
    renderWithQuery(<CheckoutView />);
    expect(await screen.findByText(/agotados o retirados/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Pagar/ })).toBeDisabled();
  });
});
