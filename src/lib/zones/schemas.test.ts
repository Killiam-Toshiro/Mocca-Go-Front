import { describe, expect, it } from 'vitest';
import {
  changedPointFields,
  createPointBody,
  hiddenByZone,
  parseFloors,
  pointLeavesNone,
  pointSchema,
  pointValuesOf,
  visiblePointCount,
  zoneLeavesNone,
  zoneSchema,
  type PointFormValues,
} from './schemas';
import type { AdminPoint, AdminZone } from './types';

const point = (over: Partial<AdminPoint> = {}): AdminPoint => ({
  id: 'p1',
  name: 'Edificio A',
  hint: 'Se entrega en la plazoleta',
  floors: 4,
  zoneId: 'z1',
  active: true,
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
  ...over,
});
const zone = (over: Partial<AdminZone> = {}): AdminZone => ({
  id: 'z1',
  name: 'Zona 1',
  active: true,
  createdAt: '2026-10-01T12:00:00.000Z',
  updatedAt: '2026-10-01T12:00:00.000Z',
  points: [point()],
  ...over,
});
const values = (over: Partial<PointFormValues> = {}): PointFormValues => ({
  ...pointValuesOf(point()),
  ...over,
});

describe('formularios de zona y punto', () => {
  it('la zona pide nombre de 1 a 60 caracteres sin contar espacios de los bordes', () => {
    expect(zoneSchema.safeParse({ name: '  ' }).success).toBe(false);
    expect(zoneSchema.safeParse({ name: 'x'.repeat(61) }).success).toBe(false);
    expect(zoneSchema.safeParse({ name: ' Zona 3 ' }).success).toBe(true);
  });

  it('el punto valida nombre, indicación, zona y pisos', () => {
    expect(pointSchema.safeParse(values()).success).toBe(true);
    expect(pointSchema.safeParse(values({ name: ' ' })).success).toBe(false);
    expect(pointSchema.safeParse(values({ zoneId: '' })).success).toBe(false);
    expect(
      pointSchema.safeParse(values({ hint: 'x'.repeat(201) })).success,
    ).toBe(false);
    for (const floors of ['', '0', '31', '1.5', 'a'])
      expect(pointSchema.safeParse(values({ floors })).success).toBe(false);
    expect(
      pointSchema.safeParse(values({ hasFloors: false, floors: '' })).success,
    ).toBe(true);
    expect(parseFloors('30')).toBe(30);
    expect(parseFloors('31')).toBeNull();
  });

  it('crear: sin indicación o sin pisos no se envían esos campos', () => {
    expect(
      createPointBody(
        values({ name: ' Nuevo ', hint: '', hasFloors: false, floors: '' }),
      ),
    ).toEqual({ zoneId: 'z1', name: 'Nuevo' });
    expect(createPointBody(values({ hint: ' Entrada ', floors: '2' }))).toEqual(
      { zoneId: 'z1', name: 'Edificio A', hint: 'Entrada', floors: 2 },
    );
  });

  it('editar envía solo lo modificado; indicación vacía y «sin pisos» van como null; mover envía zoneId', () => {
    const p = point();
    expect(changedPointFields(p, values())).toEqual({});
    expect(changedPointFields(p, values({ name: 'Otro' }))).toEqual({
      name: 'Otro',
    });
    expect(changedPointFields(p, values({ hint: '  ' }))).toEqual({
      hint: null,
    });
    expect(changedPointFields(p, values({ hasFloors: false }))).toEqual({
      floors: null,
    });
    expect(changedPointFields(p, values({ floors: '6' }))).toEqual({
      floors: 6,
    });
    expect(changedPointFields(p, values({ zoneId: 'z2' }))).toEqual({
      zoneId: 'z2',
    });
    const bare = point({ hint: null, floors: null });
    expect(
      changedPointFields(bare, {
        ...pointValuesOf(bare),
        hasFloors: true,
        floors: '3',
      }),
    ).toEqual({ floors: 3 });
  });
});

describe('lo que ve el cliente', () => {
  const zones = [
    zone({
      points: [point(), point({ id: 'p2', name: 'B', active: false })],
    }),
    zone({
      id: 'z2',
      name: 'Zona 2',
      points: [point({ id: 'p3', name: 'C', zoneId: 'z2' })],
    }),
    zone({
      id: 'z3',
      name: 'Zona 3',
      active: false,
      points: [point({ id: 'p4', name: 'D', zoneId: 'z3' })],
    }),
  ];

  it('cuenta los puntos visibles (zona y punto activos) y los que se ocultarían', () => {
    expect(visiblePointCount(zones)).toBe(2);
    expect(hiddenByZone(zones[0]!)).toBe(1);
    expect(hiddenByZone(zones[2]!)).toBe(0);
  });

  it('avisa si desactivar la zona o el punto deja a los clientes sin dónde pedir', () => {
    expect(zoneLeavesNone(zones, 'z1')).toBe(false);
    const single = [zones[0]!];
    expect(zoneLeavesNone(single, 'z1')).toBe(true);
    expect(pointLeavesNone(single, 'p1')).toBe(true);
    expect(pointLeavesNone(single, 'p2')).toBe(false);
    expect(pointLeavesNone(zones, 'p1')).toBe(false);
    // si ya no hay nada visible, no es «esta acción» la que lo deja sin puntos
    expect(zoneLeavesNone([zones[2]!], 'z3')).toBe(false);
  });
});
