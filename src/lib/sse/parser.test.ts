import { describe, expect, it } from 'vitest';
import { createSseParser, type SseMessage } from './parser';

function parse(...chunks: string[]): SseMessage[] {
  const out: SseMessage[] = [];
  const parser = createSseParser((m) => out.push(m));
  for (const chunk of chunks) parser.feed(chunk);
  return out;
}

describe('createSseParser', () => {
  it('lee evento y datos', () => {
    expect(parse('event: order\ndata: {"a":1}\n\n')).toEqual([
      { event: 'order', data: '{"a":1}' },
    ]);
  });

  it('sin `event:` el nombre es `message`', () => {
    expect(parse('data: hola\n\n')).toEqual([
      { event: 'message', data: 'hola' },
    ]);
  });

  it('une varios `data:` con salto de línea', () => {
    expect(parse('data: uno\ndata: dos\n\n')).toEqual([
      { event: 'message', data: 'uno\ndos' },
    ]);
  });

  it('acepta \\r\\n y \\r como fin de línea', () => {
    expect(parse('event: ready\r\ndata: 1\r\n\r\n')).toEqual([
      { event: 'ready', data: '1' },
    ]);
    expect(parse('event: ready\rdata: 1\r\r')).toEqual([
      { event: 'ready', data: '1' },
    ]);
  });

  it('un \\r\\n partido entre dos partes cuenta como un solo salto', () => {
    expect(parse('data: 1\r', '\n\r', '\ndata: 2\n\n')).toEqual([
      { event: 'message', data: '1' },
      { event: 'message', data: '2' },
    ]);
  });

  it('ignora comentarios (latidos) y campos desconocidos', () => {
    expect(parse(': latido\n\nid: 7\nretry: 100\ndata: x\n\n')).toEqual([
      { event: 'message', data: 'x' },
    ]);
  });

  it('un bloque sin datos no emite nada y no arrastra el nombre', () => {
    expect(parse('event: a\n\ndata: x\n\n')).toEqual([
      { event: 'message', data: 'x' },
    ]);
  });

  it('quita solo un espacio tras los dos puntos', () => {
    expect(parse('data:  dos espacios\n\n')[0]?.data).toBe(' dos espacios');
    expect(parse('data:sin espacio\n\n')[0]?.data).toBe('sin espacio');
    expect(parse('data\n\n')).toEqual([{ event: 'message', data: '' }]);
  });

  it('une bloques partidos en cualquier punto, incluso byte a byte', () => {
    const text =
      'event: order\ndata: {"n":1001}\n\n: latido\n\nevent: ready\ndata: 1\n\n';
    expect(parse(...text.split(''))).toEqual(parse(text));
    expect(parse(text)).toHaveLength(2);
  });

  it('un evento incompleto (sin línea en blanco final) no se emite', () => {
    expect(parse('event: order\ndata: x\n')).toEqual([]);
  });
});
