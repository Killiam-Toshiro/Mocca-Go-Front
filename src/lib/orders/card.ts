/** Tarjeta de demostración que el back aprueba (D-038). */
export const TEST_CARD = '4242424242424242';
export const CARD_LENGTH = 16;

/** Solo los dígitos, hasta 16. */
export function cardDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, CARD_LENGTH);
}

/** `4242424242424242` → `4242 4242 4242 4242` (se escribe mientras se teclea). */
export function formatCardNumber(value: string): string {
  return cardDigits(value).replace(/(\d{4})(?=\d)/g, '$1 ');
}

export function isValidCard(value: string): boolean {
  return cardDigits(value).length === CARD_LENGTH;
}
