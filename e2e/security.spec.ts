import { expect, test } from '@playwright/test';
import { login } from './helpers';

test.describe('CSRF y tipo de contenido', () => {
  test('POST sin Origin → 403', async ({ request }) => {
    const response = await request.post('/api/auth/logout');
    expect(response.status()).toBe(403);
  });

  test('POST desde otro origen → 403', async ({ request }) => {
    const response = await request.post('/api/auth/logout', {
      headers: { origin: 'https://evil.example' },
    });
    expect(response.status()).toBe(403);
  });

  test('POST de formulario clásico → 415', async ({ request, baseURL }) => {
    const response = await request.post('/api/auth/login', {
      headers: {
        origin: baseURL!,
        'content-type': 'application/x-www-form-urlencoded',
      },
      data: 'username=admin&password=x',
    });
    expect(response.status()).toBe(415);
  });

  test('POST sin cuerpo desde el mismo origen (Salir) → 204', async ({
    request,
    baseURL,
  }) => {
    const response = await request.post('/api/auth/logout', {
      headers: { origin: baseURL! },
    });
    expect(response.status()).toBe(204);
  });

  test('la pasarela rechaza rutas que no están en el contrato', async ({
    request,
  }) => {
    expect((await request.get('/api/no-existe')).status()).toBe(404);
    // `..` codificado: o lo rechaza la pasarela (400) o Next lo normaliza y no hay ruta (404); nunca llega al back.
    expect([400, 404]).toContain(
      (await request.get('/api/%2e%2e/menu')).status(),
    );
  });

  test('ruta privada sin sesión → 401 sin llegar al back', async ({
    request,
  }) => {
    expect((await request.get('/api/users')).status()).toBe(401);
  });
});

test.describe('cabeceras y consola', () => {
  test('CSP con nonce y cabeceras de seguridad', async ({ request }) => {
    const response = await request.get('/login');
    const headers = response.headers();
    const csp = headers['content-security-policy'] ?? '';
    expect(csp).toMatch(/script-src 'self' 'nonce-[\w+/=-]+' 'strict-dynamic'/);
    expect(csp).not.toContain('unsafe-eval');
    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBeTruthy();
  });

  test('sin errores de consola ni violaciones de CSP en login y panel', async ({
    page,
  }) => {
    const problems: string[] = [];
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type()))
        problems.push(message.text());
    });
    page.on('pageerror', (error) => problems.push(error.message));
    page.on('response', (response) => {
      if (response.status() >= 400)
        problems.push(`${response.status()} ${response.url()}`);
    });
    await page.goto('/login');
    await login(page, 'admin', '/admin');
    await page.waitForLoadState('networkidle');
    expect(problems).toEqual([]);
  });

  test('el token de sesión no aparece en el HTML ni es legible por JavaScript', async ({
    page,
  }) => {
    await login(page, 'admin', '/admin');
    const html = await page.content();
    const cookies = await page.context().cookies();
    const session = cookies.find((c) => c.name === 'session');
    expect(session?.httpOnly).toBe(true);
    expect(session?.sameSite).toBe('Lax');
    expect(html).not.toContain(session!.value);
    const readable = await page.evaluate(() => document.cookie);
    expect(readable).not.toContain('session=');
    expect(readable).toContain('session_exp=');
  });
});
