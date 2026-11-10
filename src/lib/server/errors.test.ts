// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { errorBody, jsonError } from './errors';

describe('errores del BFF', () => {
  it('usa el mismo formato que el back', () => {
    expect(errorBody(403, 'Origen de la petición no permitido.')).toEqual({
      statusCode: 403,
      message: 'Origen de la petición no permitido.',
      error: 'Forbidden',
    });
    expect(errorBody(502, 'x').error).toBe('Bad Gateway');
    expect(errorBody(504, 'x').error).toBe('Gateway Timeout');
    expect(errorBody(418, 'x').error).toBe('Error');
  });

  it('jsonError devuelve JSON sin caché y conserva otras cabeceras', async () => {
    const response = jsonError(415, 'Tipo no admitido', { 'X-Prueba': '1' });
    expect(response.status).toBe(415);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(response.headers.get('x-prueba')).toBe('1');
    expect(await response.json()).toEqual({
      statusCode: 415,
      message: 'Tipo no admitido',
      error: 'Unsupported Media Type',
    });
  });
});
