import { describe, expect, it } from 'vitest';
import { cardDigits, formatCardNumber, isValidCard, TEST_CARD } from './card';

describe('tarjeta', () => {
  it('deja solo dígitos y corta en 16', () => {
    expect(cardDigits('42a42-4242 4242 4242 4242 99')).toBe('4242424242424242');
  });
  it('formatea en grupos de 4 mientras se teclea', () => {
    expect(formatCardNumber('4')).toBe('4');
    expect(formatCardNumber('42424')).toBe('4242 4');
    expect(formatCardNumber(TEST_CARD)).toBe('4242 4242 4242 4242');
    expect(formatCardNumber('4242 4242 4242 4242 1')).toBe(
      '4242 4242 4242 4242',
    );
  });
  it('valida 16 dígitos exactos', () => {
    expect(isValidCard('4242 4242 4242 4242')).toBe(true);
    expect(isValidCard('4242 4242 4242 424')).toBe(false);
    expect(isValidCard('')).toBe(false);
  });
});
