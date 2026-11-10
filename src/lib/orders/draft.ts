import { z } from 'zod';
import { readSession, removeSession, writeSession } from './session-store';
import type { OrderFormValues } from './body';

export const DRAFT_KEY = 'mocca-go:order-draft:v1';
export const NOTE_MAX = 200;

const DraftSchema = z.object({
  pointId: z.string().min(1),
  floor: z.number().int().min(1).max(30).nullable(),
  deliveryNote: z.string().max(NOTE_MAX),
  note: z.string().max(NOTE_MAX),
});

export interface ZoneLike {
  points: { id: string; floors: number | null }[];
}

export function loadDraft(): OrderFormValues | null {
  const raw = readSession(DRAFT_KEY);
  if (!raw) return null;
  try {
    const parsed = DraftSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

/** Punto, piso y notas. **Nunca** la tarjeta (D-038). */
export function saveDraft(values: OrderFormValues): void {
  writeSession(
    DRAFT_KEY,
    JSON.stringify({
      pointId: values.pointId,
      floor: values.floor,
      deliveryNote: values.deliveryNote,
      note: values.note,
    }),
  );
}

export function clearDraft(): void {
  removeSession(DRAFT_KEY);
}

/** Descarta el borrador si el punto ya no existe o el piso ya no es válido. */
export function reconcileDraft(
  draft: OrderFormValues | null,
  zones: readonly ZoneLike[],
): OrderFormValues | null {
  if (!draft) return null;
  const point = zones
    .flatMap((zone) => zone.points)
    .find((p) => p.id === draft.pointId);
  if (!point) return null;
  if (point.floors === null) return { ...draft, floor: null };
  if (draft.floor !== null && draft.floor > point.floors)
    return { ...draft, floor: null };
  return draft;
}
