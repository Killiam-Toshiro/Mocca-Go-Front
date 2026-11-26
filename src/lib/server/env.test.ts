// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { EnvError, parseEnv } from './env';

const valid = { API_URL: 'http://localhost:3000/api/v1' };

function problemsOf(source: Record<string, string | undefined>): string[] {
  try {
    parseEnv(source);
  } catch (error) {
    if (error instanceof EnvError) return error.problems;
    throw error;
  }
  return [];
}

describe('parseEnv', () => {
  it('acepta la configuración mínima y aplica los valores por defecto', () => {
    expect(parseEnv(valid)).toEqual({
      API_URL: 'http://localhost:3000/api/v1',
      TRUST_PROXY_HOPS: 0,
      COOKIE_SECURE: false,
      ALLOWED_ORIGINS: [],
    });
  });

  it('quita la barra final de API_URL y acepta la red privada de Railway', () => {
    expect(
      parseEnv({ API_URL: 'http://api.railway.internal:8080/api/v1/' }).API_URL,
    ).toBe('http://api.railway.internal:8080/api/v1');
    expect(
      parseEnv({ API_URL: 'http://api.railway.internal:8080' }).API_URL,
    ).toBe('http://api.railway.internal:8080');
  });

  describe('API_URL', () => {
    it('es obligatoria y el mensaje la nombra', () => {
      expect(problemsOf({})).toEqual([
        expect.stringContaining('API_URL es obligatoria'),
      ]);
      expect(problemsOf({ API_URL: '   ' })).toEqual([
        expect.stringContaining('API_URL es obligatoria'),
      ]);
    });

    it.each([
      ['no es una URL', 'localhost:3000/api/v1'],
      ['usa otro protocolo', 'ftp://localhost/api/v1'],
      ['lleva credenciales', 'http://user:secreto@localhost:3000/api/v1'],
      ['lleva parámetros', 'http://localhost:3000/api/v1?x=1'],
      ['lleva fragmento', 'http://localhost:3000/api/v1#x'],
    ])('se rechaza si %s', (_motivo, API_URL) => {
      const problems = problemsOf({ API_URL });
      expect(problems).toHaveLength(1);
      expect(problems[0]).toContain('API_URL debe ser una URL http(s)');
    });

    it('nunca reproduce el valor en el mensaje de error', () => {
      const message = new EnvError(
        problemsOf({ API_URL: 'http://user:secreto@localhost/api/v1' }),
      ).message;
      expect(message).not.toContain('secreto');
      expect(message).not.toContain('user:');
    });
  });

  describe('TRUST_PROXY_HOPS', () => {
    it.each([
      [undefined, 0],
      ['', 0],
      ['0', 0],
      ['1', 1],
      [' 1 ', 1],
      ['10', 10],
    ])('%j → %j', (value, expected) => {
      expect(
        parseEnv({ ...valid, TRUST_PROXY_HOPS: value }).TRUST_PROXY_HOPS,
      ).toBe(expected);
    });

    it.each(['11', '-1', '1.5', 'uno', '1e1', '0x1'])('rechaza %j', (value) => {
      const problems = problemsOf({ ...valid, TRUST_PROXY_HOPS: value });
      expect(problems).toEqual([expect.stringContaining('TRUST_PROXY_HOPS')]);
    });
  });

  describe('COOKIE_SECURE', () => {
    it('por defecto es true solo en producción', () => {
      expect(parseEnv({ ...valid, NODE_ENV: 'production' }).COOKIE_SECURE).toBe(
        true,
      );
      expect(
        parseEnv({ ...valid, NODE_ENV: 'development' }).COOKIE_SECURE,
      ).toBe(false);
      expect(parseEnv({ ...valid, NODE_ENV: 'test' }).COOKIE_SECURE).toBe(
        false,
      );
    });

    it('el valor explícito manda sobre NODE_ENV', () => {
      expect(
        parseEnv({ ...valid, NODE_ENV: 'production', COOKIE_SECURE: 'false' })
          .COOKIE_SECURE,
      ).toBe(false);
      expect(
        parseEnv({ ...valid, NODE_ENV: 'development', COOKIE_SECURE: 'TRUE' })
          .COOKIE_SECURE,
      ).toBe(true);
    });

    it('rechaza otros valores', () => {
      expect(problemsOf({ ...valid, COOKIE_SECURE: 'si' })).toEqual([
        expect.stringContaining('COOKIE_SECURE'),
      ]);
    });
  });

  describe('ALLOWED_ORIGINS', () => {
    it('acepta una lista de orígenes exactos, sin repetidos', () => {
      expect(
        parseEnv({
          ...valid,
          ALLOWED_ORIGINS:
            'https://app.example.com, http://localhost:3001,https://app.example.com',
        }).ALLOWED_ORIGINS,
      ).toEqual(['https://app.example.com', 'http://localhost:3001']);
    });

    it.each([
      'https://app.example.com/',
      'https://app.example.com/ruta',
      'app.example.com',
      '*',
      'ftp://x.com',
    ])('rechaza %j', (value) => {
      expect(problemsOf({ ...valid, ALLOWED_ORIGINS: value })).toEqual([
        expect.stringContaining('ALLOWED_ORIGINS'),
      ]);
    });
  });

  it('reúne todos los problemas en un solo error', () => {
    const problems = problemsOf({ TRUST_PROXY_HOPS: '99', COOKIE_SECURE: 'x' });
    expect(problems).toHaveLength(3);
    expect(problems.join(' ')).toMatch(
      /API_URL.*TRUST_PROXY_HOPS.*COOKIE_SECURE/,
    );
  });
});
