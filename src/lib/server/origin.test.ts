// @vitest-environment node
import { describe, expect, it } from 'vitest';
import {
  requestCarriesBody,
  checkContentType,
  checkOrigin,
  checkRequest,
  requestHasBody,
} from './origin';

const h = (init: Record<string, string>) => new Headers(init);

describe('checkOrigin', () => {
  it.each(['GET', 'HEAD', 'OPTIONS', 'get'])('%s no exige Origin', (method) => {
    expect(checkOrigin(method, h({}))).toEqual({ ok: true });
  });

  it.each(['POST', 'PATCH', 'PUT', 'DELETE'])(
    '%s sin Origin → 403',
    (method) => {
      expect(checkOrigin(method, h({ host: 'app.test' }))).toMatchObject({
        ok: false,
        status: 403,
      });
    },
  );

  it('acepta un Origin cuyo host coincide con Host', () => {
    expect(
      checkOrigin(
        'POST',
        h({ origin: 'http://localhost:3001', host: 'localhost:3001' }),
      ),
    ).toEqual({
      ok: true,
    });
  });

  it('X-Forwarded-Host manda sobre Host (detrás del proxy de Railway)', () => {
    const headers = h({
      origin: 'https://app.example.com',
      host: 'interno:8080',
      'x-forwarded-host': 'app.example.com',
    });
    expect(checkOrigin('POST', headers)).toEqual({ ok: true });
  });

  it('compara sin distinguir mayúsculas y usa el primer X-Forwarded-Host', () => {
    const headers = h({
      origin: 'https://App.Example.com',
      'x-forwarded-host': 'app.example.com, otro.com',
    });
    expect(checkOrigin('POST', headers)).toEqual({ ok: true });
  });

  it.each([
    ['otro host', 'https://evil.test'],
    ['mismo nombre, otro puerto', 'http://app.test:9999'],
    ['subdominio', 'https://x.app.test'],
    ['null', 'null'],
    ['no es URL', 'app.test'],
    ['esquema extraño', 'file://app.test'],
  ])('rechaza Origin %s', (_motivo, origin) => {
    expect(checkOrigin('POST', h({ origin, host: 'app.test' }))).toMatchObject({
      ok: false,
      status: 403,
    });
  });

  it('acepta orígenes exactos de ALLOWED_ORIGINS', () => {
    const headers = h({
      origin: 'https://admin.example.com',
      host: 'app.test',
    });
    expect(checkOrigin('POST', headers, ['https://admin.example.com'])).toEqual(
      { ok: true },
    );
    expect(
      checkOrigin('POST', headers, ['https://otro.example.com']),
    ).toMatchObject({ ok: false });
  });

  it('sin Host ni X-Forwarded-Host rechaza', () => {
    expect(checkOrigin('POST', h({ origin: 'http://app.test' }))).toMatchObject(
      { ok: false },
    );
  });
});

describe('checkContentType', () => {
  it('sin cuerpo no exige tipo (logout)', () => {
    expect(checkContentType(h({}))).toEqual({ ok: true });
    expect(checkContentType(h({ 'content-length': '0' }))).toEqual({
      ok: true,
    });
  });

  it('con cuerpo acepta application/json con o sin charset', () => {
    expect(
      checkContentType(
        h({ 'content-length': '10', 'content-type': 'application/json' }),
      ),
    ).toEqual({
      ok: true,
    });
    expect(
      checkContentType(
        h({
          'content-length': '10',
          'content-type': 'Application/JSON; charset=utf-8',
        }),
      ),
    ).toEqual({ ok: true });
  });

  it.each([
    'text/plain',
    'application/x-www-form-urlencoded',
    'multipart/form-data; boundary=x',
    '',
  ])('con cuerpo rechaza %j → 415', (type) => {
    const headers = h({
      'content-length': '10',
      ...(type ? { 'content-type': type } : {}),
    });
    expect(checkContentType(headers)).toMatchObject({ ok: false, status: 415 });
  });

  it('transfer-encoding cuenta como cuerpo', () => {
    expect(requestHasBody(h({ 'transfer-encoding': 'chunked' }))).toBe(true);
    expect(
      checkContentType(h({ 'transfer-encoding': 'chunked' })),
    ).toMatchObject({ status: 415 });
  });
});

describe('checkContentType con cuerpo conocido', () => {
  it('exige JSON aunque no lleguen Content-Length ni Transfer-Encoding', () => {
    expect(
      checkContentType(h({ 'content-type': 'text/plain' }), true),
    ).toMatchObject({ status: 415 });
    expect(checkContentType(h({}), true)).toMatchObject({ status: 415 });
    expect(
      checkContentType(h({ 'content-type': 'application/json' }), true),
    ).toEqual({ ok: true });
  });
});

describe('checkRequest', () => {
  it('un GET pasa siempre', () => {
    expect(checkRequest('GET', h({}))).toEqual({ ok: true });
  });

  it('el 403 tiene prioridad sobre el 415', () => {
    const headers = h({
      host: 'app.test',
      'content-length': '5',
      'content-type': 'text/plain',
    });
    expect(checkRequest('POST', headers)).toMatchObject({ status: 403 });
  });

  it('origen válido y JSON → ok', () => {
    const headers = h({
      host: 'app.test',
      origin: 'http://app.test',
      'content-length': '5',
      'content-type': 'application/json',
    });
    expect(checkRequest('POST', headers)).toEqual({ ok: true });
  });

  it('origen válido pero formulario → 415', () => {
    const headers = h({
      host: 'app.test',
      origin: 'http://app.test',
      'content-length': '5',
      'content-type': 'application/x-www-form-urlencoded',
    });
    expect(checkRequest('POST', headers)).toMatchObject({ status: 415 });
  });
});

describe('requestCarriesBody', () => {
  const post = (init: RequestInit = {}) =>
    new Request('http://app.test/x', { method: 'POST', ...init });

  it('POST sin cuerpo → false (p. ej. cerrar sesión)', async () => {
    expect(await requestCarriesBody(post())).toBe(false);
  });

  it('cuerpo anunciado por Content-Length → true', async () => {
    expect(await requestCarriesBody(post({ body: '{"a":1}' }))).toBe(true);
  });

  it('cuerpo sin cabeceras (flujo) → true sin consumir el original', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('hola'));
        controller.close();
      },
    });
    const request = post({ body: stream, duplex: 'half' } as RequestInit);
    const headers = new Headers(request.headers);
    headers.delete('content-length');
    expect(await requestCarriesBody(request)).toBe(true);
    expect(await request.text()).toBe('hola');
  });

  it('cuerpo vacío en flujo → false', async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.close();
      },
    });
    const request = post({ body: stream, duplex: 'half' } as RequestInit);
    expect(await requestCarriesBody(request)).toBe(false);
  });
});
