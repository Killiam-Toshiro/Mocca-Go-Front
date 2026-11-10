import type { components } from '@/lib/api/schema';

type Product = components['schemas']['ProductResponse'];
type Movement = components['schemas']['MovementResponse'];

let counter = 0;

/** Producto del back (con costo, que la pantalla no debe mostrar). */
export function backProduct(overrides: Partial<Product> = {}): Product {
  counter += 1;
  return {
    id: `prod-${String(counter)}`,
    sku: `SKU-${String(counter).padStart(3, '0')}`,
    name: 'Capuchino',
    description: 'Café con leche',
    category: 'cafe',
    price: 4500,
    cost: 1600,
    costPercent: 35.6,
    soldOut: false,
    available: true,
    active: true,
    stock: 20,
    components: [],
    createdAt: '2026-11-01T12:00:00.000Z',
    updatedAt: '2026-11-01T12:00:00.000Z',
    ...overrides,
  };
}

export function productPage(data: Product[], total = data.length) {
  return { page: 1, limit: 100, total, totalPages: 1, data };
}

export function backMovement(overrides: Partial<Movement> = {}): Movement {
  counter += 1;
  return {
    id: `mov-${String(counter)}`,
    productId: 'prod-1',
    type: 'IN',
    quantity: 10,
    reason: 'Compra a proveedor',
    orderId: null,
    user: { id: 'u-operador', username: 'operador' },
    createdAt: '2026-11-10T15:00:00.000Z',
    ...overrides,
  };
}

export function movementPage(
  data: Movement[],
  extra: Partial<{ page: number; total: number; totalPages: number }> = {},
) {
  return {
    page: 1,
    limit: 20,
    total: data.length,
    totalPages: 1,
    data,
    ...extra,
  };
}
