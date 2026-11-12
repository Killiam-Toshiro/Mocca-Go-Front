# Tareas 007c — Admin: zonas y puntos de entrega

**Spec:** `spec.md` v3 · **Plan:** `plan.md` (aprobado el 2026-11-12). Una tarea se marca `[x]` solo con evidencia real (prueba o comando ejecutado).

## Fase 0 — Contrato
- [x] T-00 `docs/openapi.json` actualizado con el incremento 021 del back; `schema.d.ts` regenerado; `api:check` en verde.

## Fase 1 — Mock
- [x] T-01 `tests/mock-api/zones.ts`: almacén con estado (zonas y puntos del seed), reglas y textos del back (nombre único sin distinguir mayúsculas, el del punto en todo el sistema; 409 al eliminar con puntos, pedidos o rondas); vista pública (activos, sin zonas vacías).
- [x] T-02 `server.mts`: `GET /delivery-zones[/all]`, `POST|PATCH|DELETE` de zonas y puntos (solo admin); `buildZones` ya no se usa en el servidor (pedidos y despacho leen del almacén); `dispatch.usesZone`.
- [x] T-03 `zones.test.ts` (8) y el resto del mock en verde (66).

## Fase 2 — Lógica
- [x] T-04 `src/lib/zones/`: tipos, esquemas (`zoneSchema`, `pointSchema`, `createPointBody`, `changedPointFields`, impacto en lo que ve el cliente), errores (`describeZoneError`), `useAdminZones`, `invalidateZones`.
- [x] T-05 Acciones con recuperación tras corte (crear, editar/estado, eliminar de zona y punto); `schemas.test.ts`, `errors.test.ts`, `hooks.test.tsx` (25 pruebas) y `tests/utils/zones.ts`.

## Fase 3 — Pantalla
- [x] T-06 `src/components/zones/`: `ZonesView`, `ZoneCard`, `PointRow`, `ZoneForm`, `PointForm`, `ZonesPanel`, `ConfirmBox`, `ZonesNotice`, `ActiveBadge`.
- [x] T-07 Ruta `/admin/zonas`, navegación habilitada («Próximamente» del admin: 2) y pruebas de navegación actualizadas.
- [x] T-08 `zones-view.test.tsx` (19) y `route.test.ts` (3 nuevas).

## Fase 4 — E2E
- [x] T-09 `e2e/zones.spec.ts` (6 × 2 proyectos): guardas, lista, flujo completo con el cliente viendo el pago, 409 por pedidos, corte de red al crear, tamaños y desborde.

## Fase 5 — Cierre
- [x] T-10 `format:check`, `lint`, `typecheck`, `api:check`, `test` (1075), `build`, `check:bundle`, `audit --omit=dev`.
- [x] T-11 E2E completo en la nube (resultado en `docs/commits/007c.md`).
- [x] T-12 Decisiones D-124 a D-128, P-13 resuelto y P-14, README.
- [x] T-13 `docs/commits/007c.md`. **Me detengo para tu revisión; sin commit ni push.**
