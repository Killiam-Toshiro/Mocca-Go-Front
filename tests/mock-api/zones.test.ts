import { describe, expect, it } from 'vitest';
import { POINT_ID } from './orders.ts';
import {
  createZonesStore,
  POINT_HAS_ORDERS,
  POINT_NAME_TAKEN,
  ZONE_HAS_POINTS,
  ZONE_HAS_ROUNDS,
  ZONE_NAME_TAKEN,
  type AdminPoint,
  type AdminZone,
} from './zones.ts';

const ZONE1 = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ZONE2 = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const MISSING = '0b1f6f8e-9a0c-4f3e-9d5e-0a1b2c3d4e5f';

function setup(history?: {
  point?: (id: string) => boolean;
  zone?: (id: string) => boolean;
}) {
  return createZonesStore({
    usedPoint: history?.point ?? (() => false),
    usedZone: history?.zone ?? (() => false),
  });
}
const all = (s: ReturnType<typeof setup>) =>
  (s.allZones().body as { data: AdminZone[] }).data;
const message = (r: { body?: unknown }) =>
  (r.body as { message: string | string[] }).message;

describe('mock de zonas y puntos', () => {
  it('lista todo (admin) por nombre; la vista pública solo trae activos y omite zonas sin puntos activos', () => {
    const s = setup();
    expect(all(s).map((z) => z.name)).toEqual(['Zona 1', 'Zona 2']);
    expect(all(s)[0]?.points.map((p) => p.name)).toEqual([
      'Biblioteca',
      'Edificio A',
      'Plazoleta central',
    ]);
    s.updateZone(ZONE2, { active: false });
    expect(s.publicZones().map((z) => z.name)).toEqual(['Zona 1']);
    s.updatePoint(POINT_ID.edificioA, { active: false });
    s.updatePoint(POINT_ID.plazoleta, { active: false });
    s.updatePoint(POINT_ID.biblioteca, { active: false });
    expect(s.publicZones()).toEqual([]);
    expect(all(s)).toHaveLength(2);
  });

  it('crea una zona activa y vacía; nombre repetido (sin distinguir mayúsculas) 409; inválido 400', () => {
    const s = setup();
    const created = s.createZone({ name: 'Zona 3' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({
      name: 'Zona 3',
      active: true,
      points: [],
    });
    expect(message(s.createZone({ name: 'zona 3' }))).toBe(ZONE_NAME_TAKEN);
    expect(s.createZone({ name: '  ' }).status).toBe(400);
    expect(s.createZone({ name: 'x'.repeat(61) }).status).toBe(400);
    expect(s.createZone({ name: 'Ok', extra: 1 }).status).toBe(400);
    expect(s.createZone(null).status).toBe(400);
  });

  it('edita una zona (nombre y estado); sin campos 400; 404; su propio nombre no choca', () => {
    const s = setup();
    expect(s.updateZone(ZONE1, {}).status).toBe(400);
    expect(s.updateZone(MISSING, { active: false }).status).toBe(404);
    expect(s.updateZone('x', { active: false }).status).toBe(400);
    expect(s.updateZone(ZONE1, { name: 'Zona 1' }).status).toBe(200);
    expect(message(s.updateZone(ZONE1, { name: 'zona 2' }))).toBe(
      ZONE_NAME_TAKEN,
    );
    const r = s.updateZone(ZONE1, { name: 'Norte', active: false });
    expect(r.body).toMatchObject({ name: 'Norte', active: false });
    expect((r.body as AdminZone).points).toHaveLength(3);
  });

  it('elimina una zona solo sin puntos y sin rondas (409 con cada texto)', () => {
    let rounds = true;
    const s = setup({ zone: () => rounds });
    expect(message(s.removeZone(ZONE1))).toBe(ZONE_HAS_POINTS);
    const empty = (s.createZone({ name: 'Vacía' }).body as AdminZone).id;
    expect(message(s.removeZone(empty))).toBe(ZONE_HAS_ROUNDS);
    rounds = false;
    expect(s.removeZone(empty).status).toBe(204);
    expect(s.removeZone(empty).status).toBe(404);
    expect(all(s)).toHaveLength(2);
  });

  it('crea un punto con y sin indicación y pisos; zona inexistente 404; nombre repetido en cualquier zona 409', () => {
    const s = setup();
    const a = s.createPoint({ zoneId: ZONE1, name: 'Auditorio' });
    expect(a.status).toBe(201);
    expect(a.body).toMatchObject({
      hint: null,
      floors: null,
      active: true,
      zoneId: ZONE1,
    });
    const b = s.createPoint({
      zoneId: ZONE2,
      name: 'Gimnasio',
      hint: 'Entrada lateral',
      floors: 2,
    });
    expect(b.body).toMatchObject({ hint: 'Entrada lateral', floors: 2 });
    expect(s.createPoint({ zoneId: MISSING, name: 'Otro' }).status).toBe(404);
    expect(message(s.createPoint({ zoneId: ZONE2, name: 'edificio a' }))).toBe(
      POINT_NAME_TAKEN,
    );
    for (const bad of [
      { zoneId: ZONE1, name: '' },
      { zoneId: ZONE1, name: 'P', floors: 0 },
      { zoneId: ZONE1, name: 'P', floors: 31 },
      { zoneId: ZONE1, name: 'P', floors: 1.5 },
      { zoneId: ZONE1, name: 'P', hint: '' },
      { name: 'P' },
    ])
      expect(s.createPoint(bad).status).toBe(400);
  });

  it('edita un punto: borra la indicación con null, «sin pisos» con null y lo mueve de zona', () => {
    const s = setup();
    const r = s.updatePoint(POINT_ID.edificioA, { hint: null, floors: null });
    expect(r.body).toMatchObject({ hint: null, floors: null });
    const moved = s.updatePoint(POINT_ID.edificioA, { zoneId: ZONE2 });
    expect((moved.body as AdminPoint).zoneId).toBe(ZONE2);
    expect(
      all(s)
        .find((z) => z.id === ZONE2)
        ?.points.map((p) => p.name),
    ).toContain('Edificio A');
    expect(
      all(s)
        .find((z) => z.id === ZONE1)
        ?.points.map((p) => p.name),
    ).not.toContain('Edificio A');
    expect(s.updatePoint(POINT_ID.edificioA, {}).status).toBe(400);
    expect(s.updatePoint(MISSING, { name: 'X' }).status).toBe(404);
    expect(s.updatePoint(POINT_ID.edificioA, { zoneId: MISSING }).status).toBe(
      404,
    );
    expect(
      message(s.updatePoint(POINT_ID.edificioA, { name: 'Canchas' })),
    ).toBe(POINT_NAME_TAKEN);
    expect(
      s.updatePoint(POINT_ID.edificioA, { name: 'Edificio A' }).status,
    ).toBe(200);
  });

  it('elimina un punto solo si ningún pedido lo usó (409) y luego 404', () => {
    const s = setup({ point: (id) => id === POINT_ID.canchas });
    expect(message(s.removePoint(POINT_ID.canchas))).toBe(POINT_HAS_ORDERS);
    expect(s.removePoint(POINT_ID.cafeteria).status).toBe(204);
    expect(s.removePoint(POINT_ID.cafeteria).status).toBe(404);
    expect(s.removePoint('x').status).toBe(400);
  });

  it('reset vuelve al seed', () => {
    const s = setup();
    s.createZone({ name: 'Temporal' });
    s.reset();
    expect(all(s).map((z) => z.name)).toEqual(['Zona 1', 'Zona 2']);
  });
});
