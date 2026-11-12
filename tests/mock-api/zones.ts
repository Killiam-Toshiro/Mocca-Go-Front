import { randomUUID } from 'node:crypto';
import { buildZones, type MockZone } from './orders.ts';

/** Forma de `PointResponse` (admin). */
export interface AdminPoint {
  id: string;
  name: string;
  hint: string | null;
  floors: number | null;
  zoneId: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}
/** Forma de `ZoneResponse` (admin). */
export interface AdminZone {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  points: AdminPoint[];
}
export interface ZoneResult {
  status: number;
  body?: unknown;
}

const ok = (status: number, body?: unknown): ZoneResult => ({ status, body });
const err = (status: number, message: string | string[]): ZoneResult => ({
  status,
  body: { statusCode: status, message, error: 'Error' },
});

const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SEED_AT = '2026-10-01T12:00:00.000Z';

export const ZONE_NAME_TAKEN = 'Ya existe una zona con ese nombre.';
export const POINT_NAME_TAKEN = 'Ya existe un punto con ese nombre.';
export const ZONE_NOT_FOUND = 'Zona no encontrada.';
export const POINT_NOT_FOUND = 'Punto no encontrado.';
export const ZONE_HAS_POINTS =
  'La zona tiene puntos; muévelos o elimínalos antes.';
export const ZONE_HAS_ROUNDS =
  'La zona tiene rondas de despacho; desactívala en vez de eliminarla.';
export const POINT_HAS_ORDERS =
  'El punto tiene pedidos; desactívalo en vez de eliminarlo.';
const NO_FIELDS = 'Indica al menos un campo para editar.';

const byName = (a: { name: string }, b: { name: string }) =>
  a.name.localeCompare(b.name, 'es');
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

const NO_NUL = /^[^\u0000]*$/;
function checkName(
  value: unknown,
  max: number,
  problems: string[],
): value is string {
  if (typeof value !== 'string') {
    problems.push('name must be a string');
    return false;
  }
  if (value.length < 1 || value.length > max || !/\S/.test(value)) {
    problems.push(`name must be between 1 and ${String(max)} characters`);
    return false;
  }
  if (!NO_NUL.test(value)) {
    problems.push('name must not contain NUL characters');
    return false;
  }
  return true;
}

/** Controles de prueba: si un punto tiene pedidos o una zona tiene rondas (el back lo decide por FK). */
export interface ZoneHistory {
  usedPoint: (pointId: string) => boolean;
  usedZone: (zoneId: string) => boolean;
}

/**
 * Zonas y puntos del mock con las reglas y los textos del back real (módulo `delivery`, incremento 021):
 * nombres únicos sin distinguir mayúsculas (el del punto, en todo el sistema), 409 al eliminar con historial.
 */
export function createZonesStore(history: ZoneHistory) {
  let zones: AdminZone[] = seed();

  function seed(): AdminZone[] {
    return buildZones().map((zone: MockZone) => ({
      id: zone.id,
      name: zone.name,
      active: true,
      createdAt: SEED_AT,
      updatedAt: SEED_AT,
      points: zone.points.map((p) => ({
        ...p,
        zoneId: zone.id,
        active: true,
        createdAt: SEED_AT,
        updatedAt: SEED_AT,
      })),
    }));
  }

  const view = (zone: AdminZone): AdminZone => ({
    ...zone,
    points: [...zone.points].sort(byName).map((p) => ({ ...p })),
  });
  const allPoints = () => zones.flatMap((z) => z.points);
  const zoneById = (id: string) => zones.find((z) => z.id === id);
  const pointById = (id: string) => allPoints().find((p) => p.id === id);
  const now = () => new Date().toISOString();

  function allZones(): ZoneResult {
    return ok(200, { data: [...zones].sort(byName).map(view) });
  }

  /** Vista pública: solo activos; las zonas sin puntos activos se omiten. */
  function publicZones(): MockZone[] {
    return [...zones]
      .filter((z) => z.active)
      .sort(byName)
      .map((z) => ({
        id: z.id,
        name: z.name,
        points: [...z.points]
          .filter((p) => p.active)
          .sort(byName)
          .map((p) => ({
            id: p.id,
            name: p.name,
            hint: p.hint,
            floors: p.floors,
          })),
      }))
      .filter((z) => z.points.length > 0);
  }

  function parseId(id: string): ZoneResult | null {
    return UUID_V4.test(id)
      ? null
      : err(400, ['Validation failed (uuid v4 is expected)']);
  }

  function unknownFields(
    body: Record<string, unknown>,
    allowed: string[],
    problems: string[],
  ): void {
    for (const key of Object.keys(body))
      if (!allowed.includes(key))
        problems.push(`property ${key} should not exist`);
  }

  function createZone(body: Record<string, unknown> | null): ZoneResult {
    if (!body) return err(400, ['El cuerpo debe ser un objeto JSON']);
    const problems: string[] = [];
    unknownFields(body, ['name'], problems);
    checkName(body.name, 60, problems);
    if (problems.length > 0) return err(400, problems);
    const name = body.name as string;
    if (zones.some((z) => same(z.name, name))) return err(409, ZONE_NAME_TAKEN);
    const at = now();
    const zone: AdminZone = {
      id: randomUUID(),
      name,
      active: true,
      createdAt: at,
      updatedAt: at,
      points: [],
    };
    zones.push(zone);
    return ok(201, view(zone));
  }

  function updateZone(
    id: string,
    body: Record<string, unknown> | null,
  ): ZoneResult {
    const bad = parseId(id);
    if (bad) return bad;
    if (!body) return err(400, ['El cuerpo debe ser un objeto JSON']);
    const problems: string[] = [];
    unknownFields(body, ['name', 'active'], problems);
    if (body.name !== undefined) checkName(body.name, 60, problems);
    if (body.active !== undefined && typeof body.active !== 'boolean')
      problems.push('active must be a boolean value');
    if (problems.length > 0) return err(400, problems);
    if (body.name === undefined && body.active === undefined)
      return err(400, NO_FIELDS);
    const zone = zoneById(id);
    if (!zone) return err(404, ZONE_NOT_FOUND);
    if (
      typeof body.name === 'string' &&
      zones.some((z) => z.id !== id && same(z.name, body.name as string))
    )
      return err(409, ZONE_NAME_TAKEN);
    let changed = false;
    if (typeof body.name === 'string' && body.name !== zone.name) {
      zone.name = body.name;
      changed = true;
    }
    if (typeof body.active === 'boolean' && body.active !== zone.active) {
      zone.active = body.active;
      changed = true;
    }
    if (changed) zone.updatedAt = now();
    return ok(200, view(zone));
  }

  function removeZone(id: string): ZoneResult {
    const bad = parseId(id);
    if (bad) return bad;
    const zone = zoneById(id);
    if (!zone) return err(404, ZONE_NOT_FOUND);
    if (zone.points.length > 0) return err(409, ZONE_HAS_POINTS);
    if (history.usedZone(id)) return err(409, ZONE_HAS_ROUNDS);
    zones = zones.filter((z) => z.id !== id);
    return ok(204);
  }

  function pointFields(
    body: Record<string, unknown>,
    problems: string[],
    create: boolean,
  ): void {
    unknownFields(
      body,
      create
        ? ['zoneId', 'name', 'hint', 'floors']
        : ['zoneId', 'name', 'hint', 'floors', 'active'],
      problems,
    );
    if (create || body.name !== undefined) checkName(body.name, 80, problems);
    if (create || body.zoneId !== undefined)
      if (typeof body.zoneId !== 'string' || !UUID_V4.test(body.zoneId))
        problems.push('zoneId must be a UUID');
    const { hint, floors } = body;
    if (
      hint !== undefined &&
      hint !== null &&
      (typeof hint !== 'string' || hint.length < 1 || hint.length > 200)
    )
      problems.push('hint must be between 1 and 200 characters');
    if (
      floors !== undefined &&
      floors !== null &&
      (typeof floors !== 'number' ||
        !Number.isInteger(floors) ||
        floors < 1 ||
        floors > 30)
    )
      problems.push('floors must be an integer between 1 and 30');
    if (
      !create &&
      body.active !== undefined &&
      typeof body.active !== 'boolean'
    )
      problems.push('active must be a boolean value');
  }

  const nameTaken = (name: string, exceptId?: string) =>
    allPoints().some((p) => p.id !== exceptId && same(p.name, name));

  function createPoint(body: Record<string, unknown> | null): ZoneResult {
    if (!body) return err(400, ['El cuerpo debe ser un objeto JSON']);
    const problems: string[] = [];
    pointFields(body, problems, true);
    if (problems.length > 0) return err(400, problems);
    const zone = zoneById(body.zoneId as string);
    if (!zone) return err(404, ZONE_NOT_FOUND);
    if (nameTaken(body.name as string)) return err(409, POINT_NAME_TAKEN);
    const at = now();
    const point: AdminPoint = {
      id: randomUUID(),
      zoneId: zone.id,
      name: body.name as string,
      hint: (body.hint as string | null | undefined) ?? null,
      floors: (body.floors as number | null | undefined) ?? null,
      active: true,
      createdAt: at,
      updatedAt: at,
    };
    zone.points.push(point);
    return ok(201, { ...point });
  }

  function updatePoint(
    id: string,
    body: Record<string, unknown> | null,
  ): ZoneResult {
    const bad = parseId(id);
    if (bad) return bad;
    if (!body) return err(400, ['El cuerpo debe ser un objeto JSON']);
    const problems: string[] = [];
    pointFields(body, problems, false);
    if (problems.length > 0) return err(400, problems);
    const keys = ['zoneId', 'name', 'hint', 'floors', 'active'];
    if (keys.every((k) => body[k] === undefined)) return err(400, NO_FIELDS);
    const point = pointById(id);
    if (!point) return err(404, POINT_NOT_FOUND);
    let target: AdminZone | undefined;
    if (typeof body.zoneId === 'string' && body.zoneId !== point.zoneId) {
      target = zoneById(body.zoneId);
      if (!target) return err(404, ZONE_NOT_FOUND);
    }
    if (
      typeof body.name === 'string' &&
      body.name !== point.name &&
      nameTaken(body.name, id)
    )
      return err(409, POINT_NAME_TAKEN);
    const before = JSON.stringify(point);
    if (typeof body.name === 'string') point.name = body.name;
    if (body.hint !== undefined) point.hint = body.hint as string | null;
    if (body.floors !== undefined) point.floors = body.floors as number | null;
    if (typeof body.active === 'boolean') point.active = body.active;
    if (target) {
      const from = zoneById(point.zoneId);
      if (from) from.points = from.points.filter((p) => p.id !== id);
      point.zoneId = target.id;
      target.points.push(point);
    }
    if (JSON.stringify(point) !== before) point.updatedAt = now();
    return ok(200, { ...point });
  }

  function removePoint(id: string): ZoneResult {
    const bad = parseId(id);
    if (bad) return bad;
    const point = pointById(id);
    if (!point) return err(404, POINT_NOT_FOUND);
    if (history.usedPoint(id)) return err(409, POINT_HAS_ORDERS);
    const zone = zoneById(point.zoneId);
    if (zone) zone.points = zone.points.filter((p) => p.id !== id);
    return ok(204);
  }

  return {
    allZones,
    publicZones,
    createZone,
    updateZone,
    removeZone,
    createPoint,
    updatePoint,
    removePoint,
    reset() {
      zones = seed();
    },
  };
}
