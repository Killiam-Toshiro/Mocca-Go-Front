import type { MovementInput, MovementType } from './types';

export type { MovementInput };

export const REASON_MAX = 300;
export const QUANTITY_MAX_DIGITS = 9;

export interface MovementForm {
  type: MovementType;
  quantity: string;
  reason: string;
}

export interface MovementErrors {
  quantity?: string;
  reason?: string;
}

export type ParsedMovement =
  { ok: true; value: MovementInput } | { ok: false; errors: MovementErrors };

// Texto en una sola línea, sin caracteres de control (el back rechaza NUL).
const CONTROL = /[\u0000-\u001f\u007f]/;

/** Saldo que quedaría tras el movimiento (no baja de 0: el back lo rechazaría). */
export function resultingStock(
  type: MovementType,
  quantity: number,
  stock: number,
): number {
  return type === 'IN' ? stock + quantity : stock - quantity;
}

/** Valida el formulario con el saldo conocido; el back sigue siendo la autoridad. */
export function parseMovement(
  form: MovementForm,
  stock: number,
): ParsedMovement {
  const errors: MovementErrors = {};
  const raw = form.quantity.trim();
  let quantity = 0;
  if (raw === '') {
    errors.quantity = 'Escribe la cantidad.';
  } else if (
    !new RegExp(`^[1-9][0-9]{0,${String(QUANTITY_MAX_DIGITS - 1)}}$`).test(raw)
  ) {
    errors.quantity = 'La cantidad debe ser un número entero mayor que 0.';
  } else {
    quantity = Number(raw);
    if (form.type === 'OUT' && quantity > stock)
      errors.quantity = `Hay ${String(stock)}; no puedes sacar ${String(quantity)}.`;
  }

  const reason = form.reason.trim();
  if (reason === '') errors.reason = 'Escribe el motivo del movimiento.';
  else if (reason.length > REASON_MAX)
    errors.reason = `El motivo admite hasta ${String(REASON_MAX)} caracteres.`;
  else if (CONTROL.test(reason))
    errors.reason =
      'El motivo no puede tener saltos de línea ni caracteres especiales.';

  if (errors.quantity || errors.reason) return { ok: false, errors };
  return { ok: true, value: { type: form.type, quantity, reason } };
}
