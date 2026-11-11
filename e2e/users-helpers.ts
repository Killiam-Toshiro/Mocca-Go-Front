import { expect, type APIRequestContext, type Page } from '@playwright/test';
import { PASSWORD } from './helpers';

export const MOCK = 'http://127.0.0.1:4010';
export const API = `${MOCK}/api/v1`;
export const GENERIC = 'clave-generica';

export const uid = () =>
  `${Date.now().toString(36)}${Math.floor(Math.random() * 46656).toString(36)}`;

export interface MockUser {
  id: string;
  username: string;
  role: string;
  fullName: string | null;
  phone: string | null;
  email: string | null;
}

export async function adminToken(request: APIRequestContext): Promise<string> {
  const res = await request.post(`${API}/auth/login`, {
    data: { username: 'admin', password: PASSWORD },
  });
  expect(res.status()).toBe(200);
  return ((await res.json()) as { accessToken: string }).accessToken;
}

/** Crea personal directamente en el mock (con la contraseña de pruebas por defecto). */
export async function createStaff(
  request: APIRequestContext,
  over: {
    username?: string;
    role?: 'admin' | 'operador' | 'repartidor';
    fullName?: string;
    phone?: string;
    password?: string;
  } = {},
): Promise<MockUser> {
  const token = await adminToken(request);
  const role = over.role ?? 'operador';
  const body = {
    username: over.username ?? `e2e.${uid()}`,
    password: over.password ?? PASSWORD,
    role,
    ...(role === 'repartidor'
      ? { fullName: 'Repartidor Prueba', phone: '+573001112233' }
      : {}),
    ...(over.fullName ? { fullName: over.fullName } : {}),
    ...(over.phone ? { phone: over.phone } : {}),
  };
  const res = await request.post(`${API}/users`, {
    headers: { authorization: `Bearer ${token}` },
    data: body,
  });
  expect(res.status()).toBe(201);
  return (await res.json()) as MockUser;
}

/** Abre «Usuarios» y espera el título. */
export async function openUsers(page: Page): Promise<void> {
  await page.goto('/admin/usuarios');
  await expect(
    page.getByRole('heading', { name: 'Usuarios', level: 1 }),
  ).toBeVisible();
}

/** Escribe en la búsqueda y espera el resultado del servidor. */
export async function searchUsers(page: Page, text: string): Promise<void> {
  await page.getByLabel('Buscar usuario').fill(text);
}

export const rowOf = (page: Page, text: string) =>
  page.getByRole('listitem').filter({ hasText: text });
