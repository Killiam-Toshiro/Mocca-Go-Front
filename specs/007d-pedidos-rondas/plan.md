# Plan 007d — Admin y operador: pedidos y rondas

**Spec:** `spec.md` (v2, aprobada el 2026-11-12, DP-01 a DP-10) · **Estado:** aprobado el 2026-11-12 e implementado · **Siguiente paso:** tu prueba manual y revisión (`docs/commits/007d.md`)

---

## 1. Enfoque

Sin dependencias nuevas ni cambios en el back. Se reutiliza lo construido: `requestJson`/`describeApiError`, `Pagination`, `Select`, `Alert`, `Skeleton`, `StatusBadge` y `OrderTimeline` de pedidos, `LiveChannelProvider` (canal de cocina, D-060), el formulario de motivo de cocina (`CancelKitchenOrder`), los ayudantes de rondas (`roundProgress`, `isOverdue`, `itemsSummary`, `clock`) y `formatCOP`/`formatOrderDate`.

Orden: **mock** → **lógica y hooks** → **pedidos (lista y detalle)** → **rondas (lista y detalle)** → **rutas y navegación** → **E2E** → verificación y documentos.

## 2. Hallazgos que condicionan el plan

1. **Rutas ya listas:** `GET /orders`, `GET /orders/{id}`, `POST /orders/{id}/cancel`, `GET /dispatch/rounds(/{id})` y `GET /kitchen/stream` están en `routes.generated.ts`; la pasarela las sirve. Se fija con pruebas en `route.test.ts` para admin.
2. **El mock cierra esas rutas al personal:** `GET /orders` es solo del cliente y `GET /dispatch/rounds(/:id)` solo del repartidor (§3, Mock). Hay que abrirlas con las reglas del back (personal ve todo).
3. **Claves de caché propias:** `['staff-orders', …]` y `['staff-order', id]` para no mezclar con las del cliente (`['orders']`, `['order', id]`) ni con cocina (`['kitchen', …]`). El canal de cocina se abre con `invalidate={[['staff-orders'], ['staff-order'], ['kitchen']]}`.
4. **`useKitchenCancel` solo invalida cocina:** se amplía para invalidar también `['staff-orders']` y `['staff-order']` (sin cambiar su comportamiento en cocina).
5. **Sondeo de rondas de 15 s solo con la pestaña a la vista (D-122):** se reutiliza `kitchenRefetchInterval` (15 s) con `refetchIntervalInBackground: false` (TanStack pausa el intervalo con la pestaña oculta) y `refetchOnWindowFocus: true`; al salir de la pantalla el hook se desmonta y no consulta. Una prueba lo comprueba: con `document.visibilityState = 'hidden'` no sale ninguna petición. Los pedidos sin canal siguen igual (D-052).
6. **Prefijo por rol:** los componentes reciben `base` (`/admin` u `/operador`) para enlazar lista ↔ detalle ↔ ronda.
7. **Navegación:** `app-shell.test.tsx` cuenta las «Próximamente» del admin (hoy 4: «Pedidos» sale, quedan 3); el operador gana «Pedidos» y «Rondas» (`nav.test.ts`, `role-panel.test.tsx`).
8. **Id inválido:** `GET /orders/{id}` con un id que no es UUID da 400/404; ambas se muestran como «Pedido no encontrado».

## 3. Archivos

**Mock (`tests/mock-api/`)**
- `orders.ts`: `listAll(page, limit, status)` y `getAny(id)` (todos los clientes, con `customer`, `payment` y `survey`); `orders.test.ts` con los casos nuevos.
- `dispatch.ts`: `listAllRounds(query)` y `getAnyRound(id)` (todas las rondas, filtro `status`, 404 si no existe); `dispatch.test.ts`.
- `server.mts`: `GET /orders` y `GET /orders/:id` para admin y operador además del cliente; `GET /dispatch/rounds` y `/:id` para admin y operador además del repartidor; el cancelar del personal ya existe.

**Lógica (`src/lib/staff-orders/`)**
- `use-staff-orders.ts`: `STAFF_ORDERS_PAGE_SIZE = 20`, `staffOrdersUrl({ page, status })`, `useStaffOrders(filter)` con `keepPreviousData`, respaldo de 15 s sin canal (D-052), sin reintento de 4xx.
- `use-staff-order.ts`: `useStaffOrder(id)` con el mismo respaldo; 400/404 = «no encontrado».
- `filters.ts`: `STATUS_FILTERS` (Todos + los 7 con sus etiquetas de `ORDER_STATUS`) y `statusParam`.
- `format.ts`: `customerLine(order)`, `deliveryLine(order)`, `telHref(phone)`, `canCancel(status)`.
- `errors.ts`: reutiliza `describeKitchenError` para cancelar; `describeStaffOrderError` para 404/400 de lectura.

**Lógica (`src/lib/staff-rounds/`)**
- `use-staff-rounds.ts`: `STAFF_ROUNDS_PAGE_SIZE = 20`, `ROUNDS_POLL_MS = 15_000`, `staffRoundsUrl({ page, status })`, `useStaffRounds(filter)`.
- `use-staff-round.ts`: `useStaffRound(id)` con el mismo sondeo.
- `filters.ts`: Todas / Activas / Finalizadas.

**Cambios en lo existente**
- `lib/kitchen/use-kitchen-cancel.ts`: invalida también `['staff-orders']` y `['staff-order']`.
- `lib/auth/nav.ts`: «Pedidos» y «Rondas» habilitados para admin; nuevos para operador.

**Componentes (`src/components/staff-orders/` y `src/components/staff-rounds/`)**
- `staff-orders-screen.tsx` (abre el canal de cocina) → `staff-orders-view.tsx` (título, filtro, resultados `aria-live`, lista, `Pagination`, esqueleto, error con «Reintentar», vacío, insignia «En vivo») → `staff-order-row.tsx` (fila enlazada al detalle) y `status-filter.tsx`.
- `staff-order-detail.tsx` (pantalla con canal) → `order-detail-body.tsx` (secciones: productos con componentes, entrega, cliente, pago, repartidor, motivos, encuesta, historial con `OrderTimeline`) y `cancel-section.tsx` (formulario de motivo reutilizado; avisos «Entendido»).
- `staff-rounds-view.tsx` (filtro, lista, `Pagination`, estados) → `staff-round-row.tsx` (zona, repartidor, estado con ícono, horas, avance, «Atrasada N min»).
- `staff-round-detail.tsx` (repartidor con `tel:`, horas, avance, pedidos enlazados a `…/pedidos/[id]`).

**Rutas**
- `app/(app)/admin/pedidos/page.tsx`, `pedidos/[id]/page.tsx`, `rondas/page.tsx`, `rondas/[id]/page.tsx` y las mismas cuatro bajo `operador/` (cada una con `metadata` y el `base` del rol).

**Pruebas y E2E**
- Unitarias: `use-staff-orders`/`use-staff-rounds` (URL y sondeo: 15 s sin canal, 15 s en rondas, ninguno con canal ni con la pestaña oculta), `filters.test.ts`, `format.test.ts`.
- Componente: `staff-orders-view.test.tsx`, `staff-order-detail.test.tsx` (secciones, cancelar, 409/404, doble clic, corte), `staff-rounds-view.test.tsx`, `staff-round-detail.test.tsx`.
- `route.test.ts`: `GET /api/orders`, `GET /api/orders/{id}`, cancelar y `GET /api/dispatch/rounds` como admin.
- `e2e/staff-orders.spec.ts` y `e2e/staff-rounds.spec.ts` (escritorio y 360 px).

## 4. Mapa CA → pruebas

| CA | Pruebas |
|---|---|
| CA-01 | `nav.test.ts`, `app-shell.test.tsx`, `role-panel.test.tsx`; E2E de guardas (visitante, cliente, repartidor). |
| CA-02/03 | `staff-orders-view.test.tsx`, `use-staff-orders` (URL), `filters.test.ts`; E2E. |
| CA-04 | `staff-order-detail.test.tsx` (secciones, «no encontrado»), `format.test.ts`; E2E. |
| CA-05/06 | `staff-order-detail.test.tsx` (solo `recibido`/`en_preparacion`, motivo, un `POST`, 409/404, doble clic, corte); E2E (cancelar y 409). |
| CA-07 | `use-staff-orders` (sondeo según canal), E2E (el pedido de un cliente aparece sin recargar). |
| CA-08/09 | `staff-rounds-view.test.tsx`, `staff-round-detail.test.tsx`, `use-staff-rounds` (15 s, pausado si la pestaña está oculta); E2E (la ronda del repartidor y su avance). |
| CA-10/11 | Pruebas de componente (etiquetas, `aria-live`, `role="alert"`, foco); E2E 360 px sin desborde y objetivos ≥ 48 px; capturas que reviso yo. |
| CA-12/13 | `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `audit` en local; E2E completo en la nube; todo lo anterior. |

## 5. Orden de trabajo

1. **Mock:** `orders.ts`, `dispatch.ts`, `server.mts` + pruebas; que el resto siga en verde.
2. **Lógica:** hooks, filtros, formato y errores, con pruebas; ampliar `useKitchenCancel`.
3. **Pedidos:** lista y detalle con cancelar, pruebas de componente.
4. **Rondas:** lista y detalle, pruebas de componente.
5. **Rutas y navegación** (8 páginas), `route.test.ts`.
6. **E2E** (escritorio y 360 px), capturas.
7. Verificación completa, `tasks.md`, `docs/commits/007d.md`, README. **Me detengo para tu revisión; sin commit ni push.**

## 6. Riesgos

- **Mock fiel al back:** las reglas salen del código del back (el personal ve todo; cancelar solo hasta `en_preparacion`); se corrige tras tu prueba manual (P-12).
- **Canal de cocina compartido:** máximo 5 canales por usuario; la pantalla de pedidos lo abre solo mientras está visible (D-060) y no se suma al de cocina si se navega entre ellas.
- **Consumo de las rondas:** 15 s solo con la pestaña a la vista (D-122); oculta o fuera de la pantalla, cero consultas. Límite: una ventana tapada por otra aplicación sin minimizar puede contar como «a la vista» según el sistema.
- **Datos personales:** nombre y celular del cliente solo en el detalle, como texto/enlace `tel:`; nada se guarda en el navegador.
- **Doble envío al cancelar:** marca síncrona; 409/404 se explican y el detalle se refresca.

## Siguiente paso

Tu visto bueno a este plan → `tasks.md` → código y pruebas.
