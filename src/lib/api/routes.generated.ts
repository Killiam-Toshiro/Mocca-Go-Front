/* eslint-disable */
// GENERADO por scripts/gen-api.mts a partir de docs/openapi.json. No editar a mano:
// ejecuta `npm run api:types`.

export interface RouteEntry {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  /** Ruta sin /api/v1, con parámetros como {id}. */
  pattern: string;
  /** Sin security en el contrato: no exige token. */
  public: boolean;
  /** La atiende Next (login/logout), no el back directamente. */
  own: boolean;
  /** Responde text/event-stream. */
  stream: boolean;
}

export const ROUTES: readonly RouteEntry[] = [
  { method: 'POST', pattern: '/auth/login', public: true, own: true, stream: false },
  { method: 'POST', pattern: '/auth/logout', public: false, own: true, stream: false },
  { method: 'GET', pattern: '/auth/me', public: false, own: false, stream: false },
  { method: 'PATCH', pattern: '/auth/password', public: false, own: false, stream: false },
  { method: 'POST', pattern: '/customers', public: true, own: false, stream: false },
  { method: 'GET', pattern: '/customers/me', public: false, own: false, stream: false },
  { method: 'PATCH', pattern: '/customers/me', public: false, own: false, stream: false },
  { method: 'POST', pattern: '/delivery-points', public: false, own: false, stream: false },
  { method: 'DELETE', pattern: '/delivery-points/{id}', public: false, own: false, stream: false },
  { method: 'PATCH', pattern: '/delivery-points/{id}', public: false, own: false, stream: false },
  { method: 'GET', pattern: '/delivery-zones', public: true, own: false, stream: false },
  { method: 'POST', pattern: '/delivery-zones', public: false, own: false, stream: false },
  { method: 'DELETE', pattern: '/delivery-zones/{id}', public: false, own: false, stream: false },
  { method: 'PATCH', pattern: '/delivery-zones/{id}', public: false, own: false, stream: false },
  { method: 'GET', pattern: '/delivery-zones/all', public: false, own: false, stream: false },
  { method: 'POST', pattern: '/dispatch/orders/{id}/deliver', public: false, own: false, stream: false },
  { method: 'POST', pattern: '/dispatch/orders/{id}/fail', public: false, own: false, stream: false },
  { method: 'GET', pattern: '/dispatch/queue', public: false, own: false, stream: false },
  { method: 'GET', pattern: '/dispatch/rounds', public: false, own: false, stream: false },
  { method: 'POST', pattern: '/dispatch/rounds', public: false, own: false, stream: false },
  { method: 'GET', pattern: '/dispatch/rounds/{id}', public: false, own: false, stream: false },
  { method: 'GET', pattern: '/dispatch/stream', public: false, own: false, stream: true },
  { method: 'GET', pattern: '/health', public: true, own: false, stream: false },
  { method: 'GET', pattern: '/health/ready', public: true, own: false, stream: false },
  { method: 'GET', pattern: '/kitchen/orders', public: false, own: false, stream: false },
  { method: 'POST', pattern: '/kitchen/orders/{id}/ready', public: false, own: false, stream: false },
  { method: 'POST', pattern: '/kitchen/orders/{id}/start', public: false, own: false, stream: false },
  { method: 'GET', pattern: '/kitchen/stream', public: false, own: false, stream: true },
  { method: 'GET', pattern: '/menu', public: true, own: false, stream: false },
  { method: 'GET', pattern: '/metrics', public: false, own: false, stream: false },
  { method: 'GET', pattern: '/movements', public: false, own: false, stream: false },
  { method: 'POST', pattern: '/movements', public: false, own: false, stream: false },
  { method: 'GET', pattern: '/orders', public: false, own: false, stream: false },
  { method: 'POST', pattern: '/orders', public: false, own: false, stream: false },
  { method: 'GET', pattern: '/orders/{id}', public: false, own: false, stream: false },
  { method: 'POST', pattern: '/orders/{id}/cancel', public: false, own: false, stream: false },
  { method: 'POST', pattern: '/orders/{id}/survey', public: false, own: false, stream: false },
  { method: 'GET', pattern: '/orders/stream', public: false, own: false, stream: true },
  { method: 'GET', pattern: '/products', public: false, own: false, stream: false },
  { method: 'POST', pattern: '/products', public: false, own: false, stream: false },
  { method: 'DELETE', pattern: '/products/{id}', public: false, own: false, stream: false },
  { method: 'GET', pattern: '/products/{id}', public: false, own: false, stream: false },
  { method: 'PATCH', pattern: '/products/{id}', public: false, own: false, stream: false },
  { method: 'PUT', pattern: '/products/{id}/components', public: false, own: false, stream: false },
  { method: 'PATCH', pattern: '/products/{id}/sold-out', public: false, own: false, stream: false },
  { method: 'PATCH', pattern: '/products/{id}/status', public: false, own: false, stream: false },
  { method: 'GET', pattern: '/surveys', public: false, own: false, stream: false },
  { method: 'GET', pattern: '/users', public: false, own: false, stream: false },
  { method: 'POST', pattern: '/users', public: false, own: false, stream: false },
  { method: 'DELETE', pattern: '/users/{id}', public: false, own: false, stream: false },
  { method: 'GET', pattern: '/users/{id}', public: false, own: false, stream: false },
  { method: 'PATCH', pattern: '/users/{id}', public: false, own: false, stream: false },
  { method: 'PATCH', pattern: '/users/{id}/role', public: false, own: false, stream: false },
];
