// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import {
  MOCK_PASSWORD,
  startMockApi,
  type MockApi,
} from '../../../tests/mock-api/server.mts';
import { fetchSession, parseExpiry, parseMe } from './session';

let mock: MockApi;
beforeAll(async () => {
  mock = await startMockApi();
});
afterAll(async () => {
  await mock.close();
});
beforeEach(() => mock.reset());

async function token(username = 'operador'): Promise<string> {
  const response = await fetch(`${mock.url}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ username, password: MOCK_PASSWORD }),
  });
  return ((await response.json()) as { accessToken: string }).accessToken;
}

const ctx = () => ({ env: { API_URL: mock.url } });

describe('parseMe', () => {
  it('acepta id, username y rol válido', () => {
    expect(
      parseMe({ id: '1', username: 'ana', role: 'admin', extra: 1 }),
    ).toEqual({
      id: '1',
      username: 'ana',
      role: 'admin',
    });
  });

  it.each([
    null,
    'x',
    {},
    { id: 1, username: 'a', role: 'admin' },
    { id: '1', username: 'a', role: 'root' },
  ])('rechaza %j', (body) => {
    expect(parseMe(body)).toBeNull();
  });
});

describe('parseExpiry', () => {
  it('lee epoch en ms y descarta lo demás', () => {
    expect(parseExpiry('1700000000000')).toBe(1_700_000_000_000);
    for (const bad of [
      null,
      undefined,
      '',
      '0',
      '-5',
      '12.5',
      'abc',
      '1e9',
      '9'.repeat(20),
    ]) {
      expect(parseExpiry(bad)).toBeNull();
    }
  });
});

describe('fetchSession', () => {
  it('sin token → none, sin llamar al back', async () => {
    expect(await fetchSession(undefined, null, ctx())).toEqual({
      status: 'none',
    });
    expect(await fetchSession('', null, ctx())).toEqual({ status: 'none' });
    expect(mock.requests).toHaveLength(0);
  });

  it('token vigente → ok con usuario y vencimiento', async () => {
    const result = await fetchSession(await token(), '1700000000000', ctx());
    expect(result).toEqual({
      status: 'ok',
      user: { id: 'u-operador', username: 'operador', role: 'operador' },
      expiresAt: 1_700_000_000_000,
    });
  });

  it('el back responde 401 → expired', async () => {
    const t = await token();
    mock.revokeAllSessions();
    expect(await fetchSession(t, null, ctx())).toEqual({ status: 'expired' });
  });

  it('el back falla (500) → error', async () => {
    const t = await token();
    mock.behavior.failMe = true;
    expect(await fetchSession(t, null, ctx())).toEqual({ status: 'error' });
  });

  it('el back apagado → error, no expired', async () => {
    const result = await fetchSession('t', null, {
      env: { API_URL: 'http://127.0.0.1:1/api/v1' },
    });
    expect(result).toEqual({ status: 'error' });
  });

  it('respuesta con rol desconocido → error', async () => {
    const fake = (async () =>
      new Response(JSON.stringify({ id: '1', username: 'x', role: 'root' }), {
        status: 200,
      })) as typeof fetch;
    expect(await fetchSession('t', null, { ...ctx(), fetch: fake })).toEqual({
      status: 'error',
    });
  });

  it('envía la IP del cliente al back', async () => {
    await fetchSession(await token(), null, { ...ctx(), clientIp: '9.9.9.9' });
    expect(mock.requests.at(-1)!.headers['x-forwarded-for']).toBe('9.9.9.9');
  });
});
