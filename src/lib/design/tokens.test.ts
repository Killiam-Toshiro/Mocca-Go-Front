import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Guarda de la paleta (docs/design-tokens.md): lee los tokens de `globals.css` y comprueba
 * que los pares de color sigan cumpliendo WCAG AA. Si cambias un color y esta prueba falla,
 * el nuevo valor no es legible: ajústalo antes de seguir.
 */
const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
const root = /:root\s*{([\s\S]*?)\n}/.exec(css)?.[1] ?? '';

function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*(#[0-9a-fA-F]{6})\\b`).exec(root);
  if (!match) throw new Error(`Falta el token --${name} (hex de 6 dígitos).`);
  return match[1]!;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const channel = parseInt(hex.slice(i, i + 2), 16) / 255;
    return channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [
    number,
    number,
  ];
  return (light + 0.05) / (dark + 0.05);
}

/** Texto normal: 4.5:1 como mínimo. */
const TEXT: [string, string][] = [
  ['foreground', 'background'],
  ['foreground', 'secondary'],
  ['card-foreground', 'card'],
  ['popover-foreground', 'popover'],
  ['primary-foreground', 'primary'],
  ['secondary-foreground', 'secondary'],
  ['accent-foreground', 'accent'],
  ['muted-foreground', 'background'],
  ['muted-foreground', 'card'],
  ['muted-foreground', 'muted'],
  ['brand-strong', 'background'],
  ['brand-strong', 'card'],
  ['brand-strong', 'secondary'],
  ['destructive', 'background'],
  ['destructive', 'card'],
  ['destructive-foreground', 'destructive'],
];

/** Componentes de interfaz (bordes de campos, foco): 3:1 como mínimo. */
const UI: [string, string][] = [
  ['input', 'card'],
  ['input', 'background'],
  ['ring', 'background'],
  ['ring', 'card'],
  ['ring', 'secondary'],
];

describe('tokens de color (WCAG AA)', () => {
  it.each(TEXT)('texto: %s sobre %s ≥ 4.5', (fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });

  it.each(UI)('interfaz: %s sobre %s ≥ 3', (fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(3);
  });

  it('el ámbar de marca y el botón principal son el mismo color', () => {
    expect(token('brand').toLowerCase()).toBe(token('primary').toLowerCase());
  });

  it('el texto blanco sobre el ámbar NO cumple: por eso el botón lleva espresso', () => {
    expect(contrast('#ffffff', token('primary'))).toBeLessThan(4.5);
  });
});
