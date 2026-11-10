import type { MovementType } from './types';

/** Vocabulario del inventario como abasto de producción del día (D-075, D-076). */
export const STOCK_LABEL = 'Disponibles';

export const TYPE_LABEL: Record<MovementType, string> = {
  IN: 'Producción',
  OUT: 'Merma o salida',
};

export const SUBMIT_LABEL: Record<MovementType, string> = {
  IN: 'Registrar producción',
  OUT: 'Registrar salida',
};

/** Resultado de un movimiento para el aviso de la pantalla. */
export const DONE_LABEL: Record<MovementType, string> = {
  IN: 'Producción registrada',
  OUT: 'Salida registrada',
};

/** Motivos sugeridos: siguen siendo texto libre y obligatorio (D-077). */
export const REASON_SUGGESTIONS: Record<MovementType, string[]> = {
  IN: ['Producción del día', 'Reposición'],
  OUT: ['Merma', 'Consumo interno', 'Ajuste por conteo'],
};

/** Motivo por defecto de «Preparar el día» (D-078). */
export const DAY_REASON = 'Preparar el día';
