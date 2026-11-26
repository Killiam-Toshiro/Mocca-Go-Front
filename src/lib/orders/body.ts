import type { components } from '@/lib/api/schema';
import { cardDigits } from './card';

export type CreateOrderBody = components['schemas']['CreateOrderDto'];

export interface OrderFormValues {
  pointId: string;
  /** `null` si el punto no tiene pisos. */
  floor: number | null;
  deliveryNote: string;
  note: string;
}

export interface OrderLine {
  productId: string;
  quantity: number;
}

/**
 * Cuerpo exacto de `POST /orders`: las notas vacías y el piso ausente no se envían
 * (el back exige al menos un carácter y rechaza `floor` en puntos sin pisos).
 */
export function buildOrderBody(
  lines: readonly OrderLine[],
  form: OrderFormValues,
  cardNumber: string,
): CreateOrderBody {
  const deliveryNote = form.deliveryNote.trim();
  const note = form.note.trim();
  return {
    items: lines.map(({ productId, quantity }) => ({ productId, quantity })),
    pointId: form.pointId,
    ...(form.floor !== null ? { floor: form.floor } : {}),
    ...(deliveryNote ? { deliveryNote } : {}),
    ...(note ? { note } : {}),
    payment: { method: 'tarjeta_demo', cardNumber: cardDigits(cardNumber) },
  };
}

/**
 * Huella del contenido para decidir si un reintento es «el mismo pedido» (D-040).
 * Incluye solo los **últimos 4 dígitos** de la tarjeta: el número completo nunca se guarda.
 */
export function orderFingerprint(body: CreateOrderBody): string {
  const items = [...body.items]
    .map(({ productId, quantity }) => `${productId}:${quantity}`)
    .sort();
  return JSON.stringify({
    items,
    pointId: body.pointId,
    floor: body.floor ?? null,
    deliveryNote: body.deliveryNote ?? null,
    note: body.note ?? null,
    last4: body.payment.cardNumber.slice(-4),
  });
}
