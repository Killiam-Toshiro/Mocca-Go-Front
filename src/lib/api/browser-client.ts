import { createApiClient } from './client';

let handler: (() => void) | null = null;

/** El proveedor de consultas registra aquí qué hacer ante un 401 (limpiar caché y salir). */
export function setUnauthorizedHandler(next: (() => void) | null): void {
  handler = next;
}

/** Avisa que la sesión ya no es válida (lo usan las consultas privadas hechas con `requestJson`). */
export function notifyUnauthorized(): void {
  handler?.();
}

let client: ReturnType<typeof createApiClient> | undefined;

/** Cliente del navegador, con el manejo global de 401. */
export function getApiClient(): ReturnType<typeof createApiClient> {
  client ??= createApiClient({ onUnauthorized: () => handler?.() });
  return client;
}
