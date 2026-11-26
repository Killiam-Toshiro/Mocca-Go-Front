'use client';

import { requestJson } from '@/lib/api/json';
import type { CreatePointBody, UpdatePointBody } from './schemas';
import type { AdminPoint, AdminZone } from './types';
import { fetchAdminZones } from './use-admin-zones';
import { useZoneAction, type ActionHandlers } from './use-zone-action';

const call = <R>(url: string, method: string, body?: unknown) =>
  requestJson<R>(url, { method, body, handleUnauthorized: true });
const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const zoneOf = async (id: string) =>
  (await fetchAdminZones()).find((z) => z.id === id);
const pointOf = async (id: string) => {
  for (const z of await fetchAdminZones()) {
    const p = z.points.find((x) => x.id === id);
    if (p) return p;
  }
  return undefined;
};

/** `POST /delivery-zones`; si la respuesta se perdió, se busca el nombre y, si existe, se da por creada. */
export function useCreateZone(handlers?: ActionHandlers<AdminZone>) {
  return useZoneAction<{ name: string }, AdminZone>(
    (body) => call<AdminZone>('/api/delivery-zones', 'POST', body),
    async ({ name }) => {
      const found = (await fetchAdminZones()).find((z) => same(z.name, name));
      return found ? { found } : null;
    },
    handlers,
  );
}

/** `PATCH /delivery-zones/{id}` (renombrar o activar/desactivar): se recupera comparando lo guardado. */
export function useUpdateZone(handlers?: ActionHandlers<AdminZone>) {
  return useZoneAction<
    { zone: AdminZone; body: { name?: string; active?: boolean } },
    AdminZone
  >(
    ({ zone, body }) =>
      call<AdminZone>(`/api/delivery-zones/${zone.id}`, 'PATCH', body),
    async ({ zone, body }) => {
      const found = await zoneOf(zone.id);
      if (!found) return null;
      const applied =
        (body.name === undefined || found.name === body.name) &&
        (body.active === undefined || found.active === body.active);
      return applied ? { found } : null;
    },
    handlers,
  );
}

/** `DELETE /delivery-zones/{id}` (204): tras un corte, si ya no aparece se da por eliminada. */
export function useDeleteZone(handlers?: ActionHandlers<null>) {
  return useZoneAction<AdminZone, null>(
    async (zone) => {
      await call(`/api/delivery-zones/${zone.id}`, 'DELETE');
      return null;
    },
    async (zone) => ((await zoneOf(zone.id)) ? null : { found: null }),
    handlers,
  );
}

/** `POST /delivery-points`; recupera buscando el nombre (único en todo el sistema). */
export function useCreatePoint(handlers?: ActionHandlers<AdminPoint>) {
  return useZoneAction<CreatePointBody, AdminPoint>(
    (body) => call<AdminPoint>('/api/delivery-points', 'POST', body),
    async ({ name }) => {
      for (const z of await fetchAdminZones()) {
        const found = z.points.find((p) => same(p.name, name));
        if (found) return { found };
      }
      return null;
    },
    handlers,
  );
}

/** `PATCH /delivery-points/{id}` (editar, mover, activar/desactivar): recupera comparando lo guardado. */
export function useUpdatePoint(handlers?: ActionHandlers<AdminPoint>) {
  return useZoneAction<
    { point: AdminPoint; body: UpdatePointBody },
    AdminPoint
  >(
    ({ point, body }) =>
      call<AdminPoint>(`/api/delivery-points/${point.id}`, 'PATCH', body),
    async ({ point, body }) => {
      const found = await pointOf(point.id);
      if (!found) return null;
      const applied = (Object.keys(body) as (keyof UpdatePointBody)[]).every(
        (k) => found[k] === body[k],
      );
      return applied ? { found } : null;
    },
    handlers,
  );
}

/** `DELETE /delivery-points/{id}` (204): tras un corte, si ya no aparece se da por eliminado. */
export function useDeletePoint(handlers?: ActionHandlers<null>) {
  return useZoneAction<AdminPoint, null>(
    async (point) => {
      await call(`/api/delivery-points/${point.id}`, 'DELETE');
      return null;
    },
    async (point) => ((await pointOf(point.id)) ? null : { found: null }),
    handlers,
  );
}
