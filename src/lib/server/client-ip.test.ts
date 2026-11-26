// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { resolveClientIp } from './client-ip';

describe('resolveClientIp', () => {
  it('con 1 salto toma la última entrada: la que añadió el proxy', () => {
    expect(resolveClientIp('203.0.113.7', 1)).toBe('203.0.113.7');
  });

  it('ignora lo que el cliente escribió a la izquierda (cabecera falsificada)', () => {
    expect(resolveClientIp('1.2.3.4, 9.9.9.9', 1)).toBe('9.9.9.9');
  });

  it('con 2 saltos toma la penúltima', () => {
    expect(resolveClientIp('1.2.3.4, 9.9.9.9, 10.0.0.1', 2)).toBe('9.9.9.9');
  });

  it('acepta IPv6 y espacios', () => {
    expect(resolveClientIp('  2001:db8::1 ', 1)).toBe('2001:db8::1');
  });

  it.each([
    ['0 saltos', '9.9.9.9', 0],
    ['sin cabecera', null, 1],
    ['cabecera vacía', '', 1],
    ['valor que no es IP', 'no-es-ip', 1],
    ['IP con puerto', '9.9.9.9:443', 1],
    ['inyección', '9.9.9.9\r\nX-Evil: 1', 1],
    ['menos entradas que saltos', '9.9.9.9', 2],
    ['entrada final vacía', '9.9.9.9,', 1],
    ['saltos negativos', '9.9.9.9', -1],
    ['saltos no enteros', '9.9.9.9', 1.5],
  ])('no envía nada: %s', (_motivo, header, hops) => {
    expect(resolveClientIp(header, hops)).toBeNull();
  });
});
