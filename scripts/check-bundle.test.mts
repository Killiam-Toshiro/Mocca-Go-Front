import { describe, expect, it } from 'vitest';
import { findLeaks, FORBIDDEN_NAMES } from './check-bundle.mts';

describe('findLeaks', () => {
  it('no encuentra nada en código limpio', () => {
    const files = new Map([['a.js', 'console.log("hola")']]);
    expect(findLeaks(files, FORBIDDEN_NAMES)).toEqual([]);
  });

  it('detecta nombres de variables privadas y el valor de API_URL', () => {
    const files = new Map([
      ['a.js', 'x=process.env.API_URL'],
      ['b.js', 'fetch("http://back.interno:3000/api/v1")'],
    ]);
    expect(
      findLeaks(files, [...FORBIDDEN_NAMES, 'http://back.interno:3000']),
    ).toEqual([
      { file: 'a.js', needle: 'API_URL' },
      { file: 'b.js', needle: 'http://back.interno:3000' },
    ]);
  });

  it('ignora cadenas vacías', () => {
    expect(findLeaks(new Map([['a.js', 'x']]), [''])).toEqual([]);
  });
});
