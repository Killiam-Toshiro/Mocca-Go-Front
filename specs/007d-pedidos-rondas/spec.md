# Spec 007d — Admin y operador: pedidos y rondas

**Repo:** `mocca-go-front` · **Fecha:** 2026-11-12 · **Estado:** v2, aprobada el 2026-11-12 (DP-01 a DP-10; rondas con sondeo de 15 s solo con la pestaña a la vista) · decisiones en `docs/decisions.md` D-119 en adelante
**Contrato consumido:** `docs/openapi.json` (módulos `orders`, `kitchen`, `dispatch`; sin rutas nuevas) y `docs/frontend-handoff.md` §3, §5, §7 · **Siguiente paso tras aprobar:** `plan.md` → `tasks.md`

> El 007c (zonas y puntos) queda pendiente; este incremento no depende de él.

---

## 1. Objetivo

Que el **administrador y el operador** vean **todos los pedidos** (no solo los que están en cocina) y **todas las rondas de reparto**, con su detalle completo, y puedan **cancelar** un pedido que aún no salió de cocina. Hoy solo ven la cola de cocina; para saber qué pasó con un pedido ya despachado, o dónde va una ronda, no tienen pantalla.

## 2. Decisiones ya tomadas

| ID | Decisión | Origen |
|---|---|---|
| D-012 | Cada rol solo visita su prefijo; el admin `/admin`, el operador `/operador`. | Spec 001 |
| D-014 / D-016 | El navegador solo habla con `/api/...`; las operaciones de `orders` y `dispatch` ya están en la tabla de rutas. | Spec 001 |
| D-046 | Estados con texto + ícono, nunca solo color (`StatusBadge`, `ORDER_STATUS`). | Spec 003 |
| D-052 / D-060 | En vivo por SSE; con el canal conectado no hay sondeo; sin canal, sondeo de 15 s. `GET /kitchen/stream` ya sirve a operador y admin. | Spec 003b / 004 |
| D-058 | 409/404 de una acción se explican en un aviso («Entendido») y se refresca el estado. | Spec 004 |
| D-059 | Cancelar desde cocina: motivo obligatorio (≤ 200) y aviso de reembolso. | Spec 004 |
| D-111 | Las acciones que escriben no se reintentan solas. | Spec 007a |

## 3. Alcance

**Entra**
- **Pedidos** (`/admin/pedidos`, `/operador/pedidos`): lista paginada de todos los pedidos (más reciente primero) con filtro por estado; detalle del pedido (`/…/pedidos/[id]`) con productos, cliente, entrega, pago, encuesta, historial, repartidor, motivos y **cancelar** (con motivo) en `recibido`/`en_preparacion`.
- **Rondas** (`/admin/rondas`, `/operador/rondas`): lista paginada de todas las rondas con filtro Activas/Finalizadas; detalle de la ronda (`/…/rondas/[id]`) con repartidor, zona, hora de salida/estimada/fin, avance y sus pedidos (enlazados al detalle del pedido).
- «Pedidos» y «Rondas» en la navegación de **admin** (hoy «Pedidos» es «Próximamente») y de **operador** (nuevas).
- Mock ampliado y pruebas (unitarias, de componente y E2E).

**No entra**
- Empezar/terminar preparación (ya está en «Cocina»), entregar o marcar no entregado (es del repartidor), crear o reasignar rondas: el back no lo permite al personal.
- Buscar por número de pedido o por cliente (el back solo filtra por estado; ver §10).
- Métricas y encuestas agregadas (008); zonas y puntos (007c).

## 4. Contrato consumido

| Operación | Quién | Qué trae / reglas | Errores a manejar |
|---|---|---|---|
| `GET /orders?page&limit&status` | admin, operador (todos); cliente (solo los suyos) | `{ data: Order[], page, limit, total, totalPages }`, más reciente primero; `status`: `recibido`, `en_preparacion`, `listo`, `en_camino`, `entregado`, `no_entregado`, `cancelado`; `limit` 1–100. | 401, 403, 400 |
| `GET /orders/{id}` | admin, operador (cualquiera) | `Order`: `number`, `status`, `total`, `items[]` (con `components`), `delivery` (punto, zona, piso, nota, `etaAt`, `courier` si va en camino), `note`, `payment` (`method`, `last4`, `status`), `customer {name, phone}`, `cancelReason`, `failureReason`, `survey`, `events[]`. | 404 `Pedido no encontrado.` |
| `POST /orders/{id}/cancel` `{ reason }` | admin, operador | `recibido` o `en_preparacion`; `reason` obligatorio (1–200); repone el saldo y reembolsa el pago. Devuelve `Order`. | 400 `Indica el motivo de la cancelación.` · 409 `El pedido no se puede cancelar en estado «{estado}».` · 404 |
| `GET /dispatch/rounds?page&limit&status` | admin, operador (todas); repartidor (las suyas) | `{ data: Round[], … }`, más reciente primero; `status`: `activa`, `finalizada`; sin filtro, todas. `Round`: `id`, `status`, `zone {id,name}`, `courier {id,fullName,phone}`, `startedAt`, `etaAt` (salida + 15 min), `finishedAt`, `orders[]`. | 401, 403, 400 |
| `GET /dispatch/rounds/{id}` | admin, operador (cualquiera) | `Round` con sus pedidos. | 404 |
| `GET /kitchen/stream` (SSE) | admin, operador | `ready` al abrir y tras reconectar; `order` por pedido nuevo, cambio de estado o cancelación; latido cada 25 s; máximo 5 canales por usuario. | 401, 403, 429 |

**Hallazgos al cruzar el handoff, el OpenAPI y el código del back**
1. **Sin cambios obligatorios en el back:** todo lo necesario existe. El detalle y la lista de pedidos no filtran por cliente cuando el actor es admin u operador.
2. **No hay canal en vivo para rondas** de admin/operador (`/dispatch/stream` es del repartidor): las rondas se refrescan por sondeo de **15 s, solo mientras la pestaña está a la vista** (condición tuya: sin la pantalla a la vista no se consulta nada); los pedidos se refrescan con el canal de cocina, que ya emite un evento por cada cambio de estado de cualquier pedido.
3. **Sin búsqueda en `GET /orders`:** solo `status`, `page` y `limit`.
4. **`no_entregado` no se reembolsa** y su tratamiento sigue pendiente en el back: el detalle muestra el motivo, pero no ofrece acción.
5. **El personal puede cancelar solo hasta `en_preparacion`.** Un pedido `listo` o posterior da 409 (el front ni ofrece el botón).
6. **El mock hoy solo responde `GET /orders` al cliente** y `GET /dispatch/rounds` al repartidor; hay que abrirlos al personal (§8).

## 5. Decisiones de diseño propuestas (requieren tu visto bueno)

| ID | Propuesta | Alternativa |
|---|---|---|
| DP-01 | **Cuatro rutas por rol** (`/pedidos`, `/pedidos/[id]`, `/rondas`, `/rondas/[id]`) con los mismos componentes y un prefijo (`/admin` u `/operador`). El detalle es una **página** (enlace compartible, funciona con «atrás»), no un panel. | Detalle en panel lateral; una sola pantalla con pestañas. |
| DP-02 | **Lista de pedidos**: filas con número, estado (texto + ícono, D-046), hora, total, cliente, zona/punto y resumen de productos; paginada en el servidor (20 por página, `Pagination`) con filtro de estado (Todos + los 7). Por defecto, todos, más reciente primero. Al cambiar el filtro vuelve a la página 1. | Pestañas por estado; tabla HTML. |
| DP-03 | **Detalle del pedido**: encabezado con número y estado; productos (con componentes de combos), entrega (zona, punto, piso, nota), cliente (nombre y celular como enlace `tel:`), pago (método, últimos 4, aprobado/reembolsado), repartidor si va en camino, motivo de cancelación o de no entrega, **encuesta** (calificación y comentario) y el historial con horas. Reutiliza `OrderTimeline` y `StatusBadge`. | Resumido sin pago ni cliente. |
| DP-04 | **Cancelar** en el detalle con el formulario de motivo de cocina (obligatorio, ≤ 200, aviso de reembolso, D-059); solo se ofrece en `recibido` y `en_preparacion`. Si el pedido ya cambió (409/404), se explica con el texto del back en un aviso «Entendido» y el detalle se refresca. Sin reintento automático (D-111). | Cancelar también desde la lista. |
| DP-05 | **En vivo:** el canal `GET /kitchen/stream` se abre en las pantallas de pedidos y cualquier evento vuelve a consultar lista y detalle; sin canal conectado, sondeo de 15 s (D-052). Las **rondas** no tienen canal: sondeo de **15 s solo mientras la pestaña está a la vista** (decidido por ti: oculta o en otra pestaña, no hay consultas) y una consulta al volver a ella; al salir de la pantalla se detiene. Insignia «En vivo» como en cocina. | Solo sondeo en todo; botón «Actualizar». |
| DP-06 | **Lista de rondas**: filas con zona, repartidor, estado (Activa/Finalizada con ícono), salida, hora estimada y **avance** (entregados/no entregados de N); una ronda activa pasada de su hora estimada se marca «Atrasada N min» (reutiliza `isOverdue`). Filtro Todas/Activas/Finalizadas; paginada (20). | Sin filtro. |
| DP-07 | **Detalle de la ronda**: repartidor (nombre y celular como enlace `tel:`), zona, salida, estimada, fin, avance y la lista de sus pedidos (número, estado, punto, resumen) enlazada al detalle del pedido. Solo lectura. | Sin pedidos enlazados. |
| DP-08 | **Navegación:** «Pedidos» y «Rondas» habilitados para admin (reemplazan el «Pedidos» «Próximamente») y nuevos para operador, junto a «Cocina». | Solo «Pedidos». |
| DP-09 | **Sin búsqueda por número ni cliente** en esta versión (el back no la ofrece); el filtro de estado y la paginación cubren el uso diario. Si la quieres, es un cambio pequeño en el back (§10). | Buscar solo dentro de la página cargada (engañoso). |
| DP-10 | **Diseño:** móvil primero (360 px), filas y botones ≥ 48 px, sin desborde, solo tokens de color, contraste AA; horas en America/Bogota y precios en COP. | — |

## 6. Rutas y comportamiento

| Ruta | Quién | Qué muestra |
|---|---|---|
| `/admin/pedidos`, `/operador/pedidos` | admin / operador | Lista de pedidos con filtro. |
| `/admin/pedidos/[id]`, `/operador/pedidos/[id]` | admin / operador | Detalle y cancelar. |
| `/admin/rondas`, `/operador/rondas` | admin / operador | Lista de rondas con filtro. |
| `/admin/rondas/[id]`, `/operador/rondas/[id]` | admin / operador | Detalle de la ronda. |

**Reglas**
- Un identificador que no es UUID o no existe da una pantalla «Pedido no encontrado» (o «Ronda no encontrada») con enlace de vuelta a la lista.
- Seguridad: solo admin y operador; el back impone el permiso; todo texto se muestra como texto; el celular del cliente se muestra solo a este personal.
- El estado de la lista (filtro y página) vive en la pantalla; tras cancelar, se invalidan pedidos de personal, cocina y el detalle.

## 7. Criterios de aceptación

| ID | Criterio (verificable) |
|---|---|
| CA-01 | Las cuatro rutas solo las ven admin y operador (visitante → login; cliente y repartidor → su panel); «Pedidos» y «Rondas» están habilitados en la navegación de ambos. |
| CA-02 | La lista de pedidos sale de `GET /orders?page&limit=20&status` y se pagina con `Pagination`; cada fila muestra número, estado (texto + ícono), hora, total, cliente, punto y productos; esqueleto al cargar, error con «Reintentar», vacío con mensaje. |
| CA-03 | El filtro de estado se envía al servidor, vuelve a la página 1 y anuncia «N resultados». |
| CA-04 | El detalle muestra productos (con componentes), entrega, cliente (celular como enlace), pago, repartidor (en camino), motivos, encuesta e historial; un id inexistente muestra «Pedido no encontrado». |
| CA-05 | Cancelar solo se ofrece en `recibido` y `en_preparacion`; exige motivo (1–200) y avisa del reembolso; un solo `POST` con `{ reason }`; tras cancelar, el detalle y las listas se actualizan; el 409/404 se explica con el texto del back. |
| CA-06 | Doble clic no duplica y no hay reintento automático; tras un corte de red, el detalle se vuelve a consultar antes de ofrecer «Reintentar». |
| CA-07 | Con el canal de cocina conectado, un pedido nuevo o un cambio de estado aparece en la lista y el detalle sin recargar ni sondeo; sin canal, sondeo de 15 s. |
| CA-08 | La lista de rondas sale de `GET /dispatch/rounds?page&limit=20&status` (todas las rondas), con zona, repartidor, estado, horas, avance y «Atrasada N min» en activas vencidas; filtro Todas/Activas/Finalizadas; sondeo de 15 s solo con la pestaña a la vista (con la pestaña oculta no se hace ninguna consulta; una prueba lo verifica). |
| CA-09 | El detalle de la ronda muestra repartidor (celular como enlace), zona, horas, avance y sus pedidos enlazados a su detalle; un id inexistente muestra «Ronda no encontrada». |
| CA-10 | Accesibilidad: filtros con etiqueta visible, resultados con `aria-live`, estados con texto + ícono, errores con `role="alert"`, foco al título del detalle, contraste AA. |
| CA-11 | Diseño: 360 px sin desborde; filas y botones ≥ 48 px; escritorio centrado; solo tokens; COP y hora de Bogotá. |
| CA-12 | `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `audit` y `e2e` en verde. |
| CA-13 | Pruebas: unitarias (parámetros, formato, resúmenes, avance de ronda), de componente (listas, filtros, detalle, cancelar, errores, rondas) y E2E contra el mock (pedido de un cliente visible para admin y operador, cancelar, 409 de estado, ronda del repartidor visible y su avance, en vivo, 360 px). |

## 8. Mock de la API (cambios)

`GET /orders` y `GET /orders/:id` también para admin y operador (todos los pedidos de todos los clientes, con `customer`, `payment` y `survey`); `POST /orders/:id/cancel` ya admite al personal con motivo; `GET /dispatch/rounds` y `GET /dispatch/rounds/:id` para admin y operador (todas las rondas, filtro `status`). El resto del mock no cambia.

## 9. Verificación contra el back real

Con el back local y el seed:
1. Un cliente hace un pedido: aparece en «Pedidos» del admin y del operador (y se actualiza al pasar por cocina).
2. Cancelar un pedido `recibido` con motivo: queda `cancelado`, reembolsado, y el cliente lo ve cancelado.
3. Un pedido `listo` no ofrece cancelar; si otro operador lo avanza mientras tanto, el 409 se explica.
4. Un repartidor sale con una ronda: aparece como «Activa» con su avance; al entregar, el avance sube (en ≤ 15 s).
5. Un pedido entregado con encuesta muestra calificación y comentario en el detalle.

## 10. Riesgos y pendientes

- **Sin búsqueda en el back:** encontrar un pedido concreto exige filtrar por estado y paginar. Si lo necesitas, se pide al back `GET /orders?number=` o `search` (cambio pequeño); lo decides tú.
- **Rondas sin canal en vivo** para el personal: hasta 15 s de retraso; el navegador considera «a la vista» la pestaña activa y no minimizada: una ventana tapada por otra aplicación puede seguir consultando en algunos sistemas.
- **`no_entregado`:** el back no define aún su tratamiento (reembolso/reintento); el front solo lo muestra.
- **Datos personales:** el detalle muestra nombre y celular del cliente al personal; no se guardan ni se registran en el navegador.

## 11. Siguiente paso

DP aprobadas → `plan.md` (hecho, espera tu visto bueno) → `tasks.md` → código y pruebas; me detengo para tu revisión.
