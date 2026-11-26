import { describe, expect, it } from 'vitest';
import { formatOrderDate, formatTime, safeWhatsappUrl } from './format';
import { isFinalStatus, ORDER_STATUS, statusInfo } from './status';

describe('estados', () => {
  it('cada estado tiene etiqueta en español', () => {
    expect(Object.values(ORDER_STATUS).map((s) => s.label)).toEqual([
      'Recibido',
      'En preparación',
      'Listo',
      'En camino',
      'Entregado',
      'No entregado',
      'Cancelado',
    ]);
  });
  it('solo entregado, cancelado y no entregado son finales', () => {
    const finals = Object.entries(ORDER_STATUS)
      .filter(([, s]) => s.final)
      .map(([k]) => k);
    expect(finals).toEqual(['entregado', 'no_entregado', 'cancelado']);
    expect(isFinalStatus('en_camino')).toBe(false);
    expect(isFinalStatus('cancelado')).toBe(true);
  });
  it('un estado desconocido se muestra en bruto y no es final', () => {
    expect(statusInfo('raro')).toMatchObject({ label: 'raro', final: false });
  });
});

describe('formato', () => {
  it('muestra la hora de Bogotá (UTC-5)', () => {
    expect(formatTime('2026-11-10T17:31:00Z')).toMatch(/12:31/);
    expect(formatOrderDate('2026-11-10T17:31:00Z')).toMatch(/10 (de )?nov/);
    expect(formatOrderDate('2026-11-10T17:31:00Z')).toMatch(/12:31/);
  });
  it('una fecha inválida no rompe', () => {
    expect(formatOrderDate('nada')).toBe('—');
    expect(formatTime('nada')).toBe('—');
  });
  it('solo enlaza wa.me por https', () => {
    expect(safeWhatsappUrl('https://wa.me/573001234500')).toBe(
      'https://wa.me/573001234500',
    );
    expect(safeWhatsappUrl('http://wa.me/1')).toBeNull();
    expect(safeWhatsappUrl('https://wa.me.evil.com/1')).toBeNull();
    expect(safeWhatsappUrl('javascript:alert(1)')).toBeNull();
    expect(safeWhatsappUrl(null)).toBeNull();
    expect(safeWhatsappUrl('')).toBeNull();
  });
});
