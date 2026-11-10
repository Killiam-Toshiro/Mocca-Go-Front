export interface SseMessage {
  /** Nombre del evento (`message` si el servidor no lo indica). */
  event: string;
  /** Líneas `data:` unidas con `\n`. */
  data: string;
}

/**
 * Analizador del formato `text/event-stream`. Recibe texto por partes (un bloque puede llegar
 * partido en cualquier punto) y emite un mensaje por cada evento completo, es decir, cerrado
 * con una línea en blanco. Los comentarios (`:`) y los campos desconocidos se ignoran.
 */
export function createSseParser(onMessage: (message: SseMessage) => void): {
  feed: (chunk: string) => void;
} {
  let buffer = '';
  let event = '';
  let data: string[] = [];
  // Un `\r` al final de una parte puede ser la mitad de un `\r\n`.
  let skipLineFeed = false;

  function handleLine(line: string): void {
    if (line === '') {
      if (data.length > 0) {
        onMessage({ event: event || 'message', data: data.join('\n') });
      }
      event = '';
      data = [];
      return;
    }
    if (line.startsWith(':')) return;
    const colon = line.indexOf(':');
    const field = colon < 0 ? line : line.slice(0, colon);
    let value = colon < 0 ? '' : line.slice(colon + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value;
    else if (field === 'data') data.push(value);
  }

  function feed(chunk: string): void {
    let text = buffer + chunk;
    buffer = '';
    if (skipLineFeed) {
      if (text.startsWith('\n')) text = text.slice(1);
      skipLineFeed = false;
    }
    let start = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      if (char !== '\n' && char !== '\r') continue;
      handleLine(text.slice(start, i));
      if (char === '\r') {
        if (text[i + 1] === '\n') i++;
        else if (i + 1 === text.length) skipLineFeed = true;
      }
      start = i + 1;
    }
    buffer = text.slice(start);
  }

  return { feed };
}
