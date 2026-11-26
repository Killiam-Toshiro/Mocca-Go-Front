# Plan 007c — Admin: zonas y puntos de entrega

**Spec:** `spec.md` (v3, DP-01 a DP-10 aprobados el 2026-11-12; DP-06 y DP-10 ajustados al incremento 021 del back) · **Estado:** aprobado el 2026-11-12 e implementado · **Siguiente paso:** tu prueba manual y revisión (`docs/commits/007c.md`)

---

## 1. Enfoque

Sin dependencias nuevas ni cambios en el back. Se reutiliza lo de 007a/007b: `requestJson`/`ApiError`/`describeApiError`, `FormField`, `Input`, `Select`, `Alert`, `DialogPanel`, `Skeleton`, los patrones de hooks (marca síncrona, `latest`, sin reintento de escrituras, recuperación tras corte de red) y las confirmaciones en línea de 007b.

Orden: **mock** → **lógica y hooks** → **pantalla** → **ruta y navegación** → **E2E** → verificación y documentos.

## 2. Hallazgos que condicionan el plan

1. **Rutas listas:** las 7 operaciones están en `routes.generated.ts`; se fijan con pruebas en `route.test.ts`. `GET /delivery-zones` es pública; `GET /delivery-zones/all` es solo admin.
2. **El mock hoy es estático:** `buildZones()` (en `orders.ts`) devuelve zonas fijas y lo usan el servidor, `createOrderStore` y `createDispatchStore`. Se reemplaza por un almacén con estado que entrega la vista pública (activas con puntos activos) y la de admin, **conservando los ids de `POINT_ID`** para no romper pruebas existentes.
3. **Pedido a un punto inactivo:** `createOrderStore` busca el punto en la vista pública, así que un punto o zona desactivados dan el mismo rechazo que hoy da uno inexistente; no hace falta tocar ese código.
4. **Clave pública `['zones']`** (la usa `useZones` del pago, `staleTime` 60 s): tras cada cambio se invalida (solo la marca como vieja; el endpoint público admite 20 peticiones/min por IP), y la lista del admin usa `['admin-zones']`. Tras tocar una zona se usa la respuesta (trae sus puntos); tras tocar o mover un punto la respuesta trae solo el punto, así que se vuelve a consultar `GET /delivery-zones/all`.
5. **409 al eliminar con historial (incremento 021 del back):** `docs/openapi.json` y `schema.d.ts` ya se actualizaron (`api:check` en verde). El almacén del mock necesita saber si un punto tiene pedidos o una zona tiene rondas: se le inyectan `usedPoint(id)` y `usedZone(id)`, que el servidor resuelve con los almacenes de pedidos y rondas, y responde los textos exactos del back.
6. **Navegación:** «Zonas y puntos» pasa a habilitado: las «Próximamente» del admin bajan de 3 a 2 (Métricas, Encuestas); se actualizan `nav.test.ts`, `app-shell.test.tsx` (hoy usa «Zonas y puntos» como ejemplo de «Próximamente») y `role-panel.test.tsx`.

## 3. Archivos

**Mock (`tests/mock-api/`)**
- Nuevo `zones.ts`: `createZonesStore({ usedPoint, usedZone })` con `allZones()`, `publicZones()` (activas con puntos activos, orden por nombre), `createZone`, `updateZone`, `removeZone`, `createPoint`, `updatePoint`, `removePoint`; validaciones y textos del back (nombre 1–60/1–80, indicación 1–200, pisos 1–30 o `null`, al menos un campo, nombre de zona único y **nombre de punto único global**, 404 de zona/punto, 409 «La zona tiene puntos; muévelos o elimínalos antes.», **409** «El punto tiene pedidos; desactívalo en vez de eliminarlo.» / «La zona tiene rondas de despacho; desactívala en vez de eliminarla.»).
- `orders.ts`: `buildZones` pasa a ser el dato semilla que usa `zones.ts` (`POINT_ID` intactos); `usesPoint(id)`. `dispatch.ts`: `usesZone(id)`.
- `server.mts`: `GET /delivery-zones` (público) y `GET /delivery-zones/all`, `POST/PATCH/DELETE /delivery-zones`, `POST/PATCH/DELETE /delivery-points` (solo admin; 403/401 al resto); el almacén reemplaza a `buildZones()` en pedidos y despacho.
- `zones.test.ts`.

**Lógica (`src/lib/zones/`)**
- `types.ts` (`AdminZone`, `AdminPoint` del esquema generado), `schemas.ts`: `zoneSchema` (nombre 1–60 con carácter visible), `pointSchema` (nombre 1–80, indicación 0–200, `hasFloors` + `floors` 1–30, `zoneId`), `changedPointFields(original, values)` (solo lo modificado; indicación vacía → `null`; sin pisos → `null`), `activeSummary(zones)` (cuántos puntos activos tiene una zona y cuántos quedarían visibles para el cliente tras una acción: base de DP-03/04/07).
- `errors.ts`: `describeZoneError(error, context)` → nombre repetido bajo el campo, 400 por campo, 404/409 con el texto del back, 409 por historial → texto del back con opción de desactivar (DP-06), 500/desconocido → error genérico, red caída.
- `use-admin-zones.ts` (`['admin-zones']`, `refetchOnWindowFocus`), `invalidateZones(queryClient)` (`['admin-zones']` y `['zones']`).
- `use-zone-actions.ts` (crear, renombrar, estado, eliminar) y `use-point-actions.ts` (crear, editar/mover, estado, eliminar): sin reintento, marca síncrona; tras un corte al crear se consulta `GET /delivery-zones/all` y se confirma por nombre (D-118).

**Componentes (`src/components/zones/`)**
- `zones-view.tsx` (título, «Crear zona», lista de tarjetas, esqueleto, error con «Reintentar», vacío «Aún no hay zonas. Crea la primera», aviso `role="status"`).
- `zone-card.tsx` (nombre, estado con texto + ícono, nº de puntos, «Renombrar», activar/desactivar, «Eliminar» solo sin puntos o explicación, «Agregar punto»), `point-row.tsx` (nombre, indicación, pisos o «Sin pisos», estado, editar, activar/desactivar, eliminar).
- `zone-panel.tsx` (crear/renombrar zona), `point-panel.tsx` (crear/editar punto: nombre, indicación con contador, casilla «Este lugar tiene pisos» + número, selector «Zona» para mover con las inactivas marcadas).
- `confirm-status.tsx` y `confirm-delete.tsx` (confirmación en línea; el texto de desactivar usa `activeSummary`; el de eliminar, si falla con 409 por historial, muestra el texto del back y ofrece «Desactivar»), `zones-notice.tsx` («Entendido»).

**Ruta y navegación**
- `app/(app)/admin/zonas/page.tsx` (+ `metadata`); `lib/auth/nav.ts` (habilita «Zonas y puntos»); pruebas de navegación actualizadas.

**Pruebas**
- Mock: `zones.test.ts`.
- Unitarias: `schemas.test.ts`, `errors.test.ts`, `hooks.test.tsx` (cuerpos exactos, sin reintento, doble clic, corte de red, invalidaciones).
- Componente: `zones-view.test.tsx` (lista, paneles, mover, confirmaciones con avisos, errores).
- `route.test.ts`: las operaciones de zonas y puntos por la pasarela.
- `e2e/zones.spec.ts` (escritorio y 360 px).

## 4. Mapa CA → pruebas

| CA | Pruebas |
|---|---|
| CA-01 | `nav.test.ts`, `app-shell.test.tsx`, `role-panel.test.tsx`; E2E de guardas. |
| CA-02 | `zones-view.test.tsx` (lista con inactivos y zonas vacías, esqueleto, error, vacío), E2E. |
| CA-03 | `schemas.test.ts`, `zones-view.test.tsx`, `hooks.test.tsx`; E2E (crear, renombrar, nombre repetido). |
| CA-04 | `schemas.test.ts` (`changedPointFields`, `null`), `zones-view.test.tsx`, `hooks.test.tsx` (cuerpo exacto); E2E. |
| CA-05 | `zones-view.test.tsx` (selector de zona), `errors.test.ts` (nombre global repetido); E2E (mover). |
| CA-06 | `schemas.test.ts` (`activeSummary`), `zones-view.test.tsx` (avisos, cancelar no envía); E2E. |
| CA-07 | `zones-view.test.tsx`, `errors.test.ts` (409 por historial → desactivar), mock con historial; E2E (eliminar sin pedidos; con pedidos → 409 → desactivar; zona con rondas). |
| CA-08 | `hooks.test.tsx` (invalida `['zones']`); E2E: el pago del cliente muestra la zona/punto nuevo, no muestra el desactivado. |
| CA-09 | `hooks.test.tsx` (doble clic, sin reintento, corte con y sin efecto), E2E con `page.route`. |
| CA-10 | Etiquetas, `aria-describedby`, `status`/`alert`, foco: `zones-view.test.tsx` y E2E. **Revisión con lector de pantalla: tuya.** |
| CA-11 | E2E: sin desborde y botones ≥ 48 px en escritorio y 360 px; capturas. |
| CA-12 | Comandos de la verificación (§6). |
| CA-13 | Todo lo anterior. |

## 5. Decisiones que se registrarán

D-124 (pantalla única con tarjetas de zona y puntos, panel para crear/editar), D-125 (confirmación al activar/desactivar y eliminar; avisos con conteos y «sin dónde pedir» sin bloquear), D-126 (eliminar con historial: el 409 del back se muestra tal cual y se ofrece «Desactivar»), D-127 (pisos con casilla y `null`; solo lo modificado; mover con selector), D-128 (invalidación de `['zones']` y `['admin-zones']`). Pendiente **P-14** (prueba manual contra el back real); P-13 quedó resuelto por el incremento 021.

## 6. Verificación al cerrar

`format:check`, `lint`, `typecheck`, `api:check`, `npm test`, `build` (aparece `/admin/zonas`), `check:bundle`, `npm audit --omit=dev`, E2E completo en la nube (≈ 8 min) y capturas de escritorio y 360 px. Luego `tasks.md`, `docs/commits/007c.md`, fila 007c del README y me detengo para tu revisión (sin commit ni push).

## 7. Riesgos

- **Mock vs back real en el 409:** los textos vienen del incremento 021 y de su suite e2e; la prueba manual (P-14) confirma que coinciden con el back corriendo.
- **`buildZones` compartido:** cambiar el origen de zonas toca pedidos y despacho del mock; se cubre corriendo todas las pruebas del mock y el E2E completo.
