import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CART_KEY,
  clearRaw,
  readRaw,
  resetStorageForTests,
  writeRaw,
} from './storage';

beforeEach(() => {
  resetStorageForTests();
  window.localStorage.clear();
});
afterEach(() => vi.restoreAllMocks());

describe('storage del carrito', () => {
  it('escribe, lee y borra en localStorage con la clave versionada', () => {
    writeRaw('hola');
    expect(window.localStorage.getItem(CART_KEY)).toBe('hola');
    expect(readRaw()).toBe('hola');
    clearRaw();
    expect(window.localStorage.getItem(CART_KEY)).toBeNull();
    expect(readRaw()).toBeNull();
  });

  it('la clave lleva versión', () => {
    expect(CART_KEY).toBe('mocca-go:cart:v1');
  });

  it('si localStorage lanza al leer, sigue funcionando en memoria', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(readRaw()).toBeNull();
    writeRaw('en memoria');
    expect(readRaw()).toBe('en memoria');
  });

  it('si localStorage lanza al escribir (lleno o modo privado), usa memoria', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('cuota');
    });
    writeRaw('uno');
    expect(readRaw()).toBe('uno');
    writeRaw('dos');
    expect(readRaw()).toBe('dos');
    clearRaw();
    expect(readRaw()).toBeNull();
  });
});
