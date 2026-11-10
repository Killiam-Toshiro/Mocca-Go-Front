import { beforeEach, describe, expect, it } from 'vitest';
import { ATTEMPT_KEY, clearAttempt, getAttemptKey } from './attempt';
import { readSession, resetSessionStoreForTests } from './session-store';

beforeEach(() => {
  window.sessionStorage.clear();
  resetSessionStoreForTests();
});

describe('clave de idempotencia', () => {
  it('es un UUID v4 y se reutiliza con la misma huella', () => {
    const first = getAttemptKey('A');
    expect(first).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
    expect(getAttemptKey('A')).toBe(first);
  });
  it('cambia si cambia la huella', () => {
    const first = getAttemptKey('A');
    const second = getAttemptKey('B');
    expect(second).not.toBe(first);
    expect(getAttemptKey('B')).toBe(second);
  });
  it('se borra al terminar', () => {
    const first = getAttemptKey('A');
    clearAttempt();
    expect(readSession(ATTEMPT_KEY)).toBeNull();
    expect(getAttemptKey('A')).not.toBe(first);
  });
  it('ignora datos dañados', () => {
    window.sessionStorage.setItem(ATTEMPT_KEY, '{no es json');
    expect(getAttemptKey('A')).toBeTruthy();
  });
});
