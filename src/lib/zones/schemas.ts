import { z } from 'zod';
import type { AdminPoint, AdminZone } from './types';

/** Mismos límites que el back; su mensaje sigue siendo la autoridad. */
export const ZONE_NAME_MAX = 60;
export const POINT_NAME_MAX = 80;
export const HINT_MAX = 200;
export const FLOORS_MAX = 30;

export const ZONE_NAME_MESSAGE = `El nombre debe tener entre 1 y ${String(ZONE_NAME_MAX)} caracteres.`;
export const POINT_NAME_MESSAGE = `El nombre debe tener entre 1 y ${String(POINT_NAME_MAX)} caracteres.`;
export const HINT_MESSAGE = `La indicación puede tener hasta ${String(HINT_MAX)} caracteres.`;
export const FLOORS_MESSAGE = `Los pisos son un número entero de 1 a ${String(FLOORS_MAX)}.`;
export const ZONE_REQUIRED_MESSAGE = 'Elige la zona.';

export const zoneSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, ZONE_NAME_MESSAGE)
    .max(ZONE_NAME_MAX, ZONE_NAME_MESSAGE),
});
export type ZoneFormValues = z.infer<typeof zoneSchema>;

export interface PointFormValues {
  zoneId: string;
  name: string;
  hint: string;
  hasFloors: boolean;
  /** Texto del campo; solo cuenta si `hasFloors`. */
  floors: string;
}

/** Entero escrito solo con dígitos; cualquier otra cosa da `null`. */
export function parseFloors(text: string): number | null {
  const value = text.trim();
  if (!/^\d{1,3}$/.test(value)) return null;
  const n = Number(value);
  return n >= 1 && n <= FLOORS_MAX ? n : null;
}

export const pointSchema = z
  .object({
    zoneId: z.string().min(1, ZONE_REQUIRED_MESSAGE),
    name: z
      .string()
      .trim()
      .min(1, POINT_NAME_MESSAGE)
      .max(POINT_NAME_MAX, POINT_NAME_MESSAGE),
    hint: z.string().trim().max(HINT_MAX, HINT_MESSAGE),
    hasFloors: z.boolean(),
    floors: z.string(),
  })
  .superRefine((v, ctx) => {
    if (v.hasFloors && parseFloors(v.floors) === null)
      ctx.addIssue({
        code: 'custom',
        path: ['floors'],
        message: FLOORS_MESSAGE,
      });
  });

export interface CreatePointBody {
  zoneId: string;
  name: string;
  hint?: string;
  floors?: number;
}

/** Cuerpo de `POST /delivery-points`: sin indicación o sin pisos, el campo no se envía. */
export function createPointBody(v: PointFormValues): CreatePointBody {
  const body: CreatePointBody = { zoneId: v.zoneId, name: v.name.trim() };
  if (v.hint.trim()) body.hint = v.hint.trim();
  if (v.hasFloors) {
    const floors = parseFloors(v.floors);
    if (floors !== null) body.floors = floors;
  }
  return body;
}

export interface UpdatePointBody {
  zoneId?: string;
  name?: string;
  hint?: string | null;
  floors?: number | null;
  active?: boolean;
}

export const pointValuesOf = (p: AdminPoint): PointFormValues => ({
  zoneId: p.zoneId,
  name: p.name,
  hint: p.hint ?? '',
  hasFloors: p.floors !== null,
  floors: p.floors === null ? '' : String(p.floors),
});

/** Solo lo modificado: indicación vacía → `null`; «sin pisos» → `null`; mover envía `zoneId`. */
export function changedPointFields(
  original: AdminPoint,
  v: PointFormValues,
): UpdatePointBody {
  const body: UpdatePointBody = {};
  if (v.zoneId !== original.zoneId) body.zoneId = v.zoneId;
  if (v.name.trim() !== original.name) body.name = v.name.trim();
  const hint = v.hint.trim() === '' ? null : v.hint.trim();
  if (hint !== original.hint) body.hint = hint;
  const floors = v.hasFloors ? parseFloors(v.floors) : null;
  if (floors !== original.floors) body.floors = floors;
  return body;
}

/** Un punto es visible para el cliente si él y su zona están activos. */
export function visiblePointCount(zones: readonly AdminZone[]): number {
  return zones
    .filter((z) => z.active)
    .reduce((n, z) => n + z.points.filter((p) => p.active).length, 0);
}

/** Cuántos puntos dejaría de ver el cliente si se desactiva la zona. */
export function hiddenByZone(zone: AdminZone): number {
  return zone.active ? zone.points.filter((p) => p.active).length : 0;
}

/** ¿Desactivar la zona deja a los clientes sin ningún punto donde pedir? */
export function zoneLeavesNone(
  zones: readonly AdminZone[],
  zoneId: string,
): boolean {
  return (
    visiblePointCount(zones.filter((z) => z.id !== zoneId)) === 0 &&
    visiblePointCount(zones) > 0
  );
}

/** ¿Desactivar o eliminar el punto deja a los clientes sin ningún punto donde pedir? */
export function pointLeavesNone(
  zones: readonly AdminZone[],
  pointId: string,
): boolean {
  const rest = zones.map((z) => ({
    ...z,
    points: z.points.filter((p) => p.id !== pointId),
  }));
  return visiblePointCount(rest) === 0 && visiblePointCount(zones) > 0;
}
