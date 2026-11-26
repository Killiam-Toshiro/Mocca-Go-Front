# Spec 004 — Cocina

**Repo:** `mocca-go-front` · **Fecha:** 2026-11-10 · **Estado:** aprobada el 2026-11-10 (v1.1; DP-01 a DP-10 pasan a D-055 a D-064)
**Contrato consumido:** `docs/openapi.json` (módulos `kitchen` y `POST /orders/{id}/cancel`) y `docs/frontend-handoff.md` §6–7 · **Siguiente paso tras aprobar:** `plan.md` → `tasks.md`

---

## 1. Objetivo

Que el **operador y el admin** vean en vivo los pedidos que debe preparar y los vaya moviendo: **«Empezar»** (recibido → en preparación) y **«Marcar listo»** (en preparación → listo), con la posibilidad de **cancelar** un pedido con motivo mientras no esté listo. La pantalla se mantiene al día sola (canal SSE de cocina) y avisa cuando entra un pedido nuevo. Cada cambio se refleja en el seguimiento del cliente (003b) sin que nadie recargue.

## 2. Decisiones ya tomadas

| ID | Decisión | Origen |
|---|---|---|
| D-012 | Cada rol solo visita su prefijo (`/operador` para el operador; el admin solo `/admin`). Por eso la cocina del admin vive en `/admin/cocina`. | Spec 001 |
| D-014 / D-016 | El navegador solo habla con `/api/...`; la pasarela agrega el `Bearer` y solo deja pasar rutas del contrato. `GET /kitchen/orders`, `POST /kitchen/orders/{id}/start|ready`, `GET /kitchen/stream` y `POST /orders/{id}/cancel` ya están en la tabla. | Spec 001 |
| D-046 | Estados con texto + ícono, nunca solo color. | Spec 003 |
| D-047 a D-054 | Cliente SSE propio, un canal por pestaña, un evento = volver a consultar, reconexión, vigilante de latido, respaldo con sondeo, indicador «En vivo». | Spec 003b |

## 3. Alcance

**Entra**
- Página de cocina para el operador (`/operador/cocina`) y para el admin (`/admin/cocina`), con la misma pantalla; «Cocina» habilitado en la navegación de ambos.
- Tablero con tres vistas del trabajo: **Por preparar** (recibido), **En preparación** y **Listos** (esperan al repartidor).
- Tarjeta de pedido con lo que la cocina necesita (productos y componentes de combos, nota, punto de entrega, tiempo de espera).
- Acciones «Empezar» y «Marcar listo» con manejo del 409 (otro operador ya cambió el estado).
- Cancelar con motivo obligatorio (recibido y en preparación).
- Actualización en vivo por `GET /kitchen/stream`, aviso de pedidos nuevos, indicador «En vivo» y respaldo con sondeo.
- Mock de la API ampliado y pruebas (unitarias, de componente y E2E).

**No entra**
- Marcar productos como «agotado», inventario y movimientos: van en el **incremento 004b** (siguen deshabilitados en la navegación del operador; ver §9).
- Vistas de rondas y despacho (005) y el listado general de pedidos del admin (007).
- Sonidos o notificaciones del navegador.
- Historial de pedidos ya despachados, impresión de comandas, métricas.
- Deshacer un cambio de estado (el back no lo ofrece).

## 4. Contrato consumido

| Operación | Comportamiento |
|---|---|
| `GET /kitchen/orders?status=&page=&limit=` (operador y admin) | `{ page, limit, total, totalPages, data: OrderResponse[] }`. Sin `status`: `recibido` y `en_preparacion`, el más antiguo primero. Con `status` (`recibido`, `en_preparacion` o `listo`) filtra por uno. `limit` máximo 100. |
| `POST /kitchen/orders/{id}/start` | `recibido → en_preparacion`. Responde el `OrderResponse` actualizado. 409 si el pedido ya no está en `recibido`; 404 si no existe. Registra quién y cuándo (el back) y avisa al cliente y a la cocina. |
| `POST /kitchen/orders/{id}/ready` | `en_preparacion → listo`. Responde el pedido actualizado. 409 si no está en `en_preparacion`. |
| `POST /orders/{id}/cancel` con `{ reason }` | Admin y operador: en `recibido` o `en_preparacion`; `reason` obligatorio (1–200). Reembolsa el pago de demostración y devuelve el saldo. 409 si ya no se puede; 404; 400. |
| `GET /kitchen/stream` | `text/event-stream`: `ready` al abrir y al reconectar, un evento `order` por cada pedido nuevo, cambio de estado o cancelación, latido cada 25 s. Máximo 5 canales por usuario. 401, 403, 429. |

`OrderResponse` es el mismo del cliente (`number`, `status`, `items` con `components`, `delivery`, `note`, `customer {name, phone}`, `createdAt`, `events`, …). **El contenido del evento `order` no se usa** (D-049): cada evento vuelve a consultar la cola.

## 5. Decisiones de diseño propuestas (requieren tu visto bueno)

| ID | Propuesta | Alternativa |
|---|---|---|
| DP-01 ✅ | **La misma pantalla de cocina en dos rutas:** `/operador/cocina` (operador) y `/admin/cocina` (admin), cada una detrás de su guarda de rol (D-012). «Cocina» aparece en la navegación de los dos. Confirmado por ti: el admin también ve la cocina. | Solo operador. |
| DP-02 | **Tablero en tres columnas** (Por preparar · En preparación · Listos) en pantallas anchas; en estrechas, **pestañas** con contador. Cada columna del pedido más antiguo al más nuevo. Son tres consultas (`status=recibido`, `en_preparacion`, `listo`) de hasta 100 pedidos. **«Listos» solo contiene los pedidos que esperan al repartidor:** en cuanto un repartidor los toma (`en_camino`) o se entregan, salen de la cocina; los entregados nunca se acumulan aquí. Aun así, si el reparto se atrasa la columna podría crecer, así que **«Listos» usa tarjetas compactas** (número, resumen de productos y tiempo esperando), **muestra los 10 más antiguos** y un botón «Ver los N listos» para el resto. | Una sola lista con filtros; «Listos» con tarjetas completas. |
| DP-03 | **Tarjeta del pedido:** número grande; tiempo desde que llegó («hace 8 min», se actualiza cada 30 s con la hora del back); productos con cantidad y, en combos, sus componentes; la **nota** para la cocina resaltada; punto de entrega (zona, punto, piso). **Sin precios ni datos de pago.** Incluye el **nombre y el teléfono del cliente** (el teléfono como enlace `tel:`) para que la cocina pueda validar algo con él (confirmado por ti); en las tarjetas compactas de «Listos» solo el nombre. | Mostrar también totales. |
| DP-04 ✅ | **Acciones grandes y sin confirmación (confirmado por ti):** «Empezar» en Por preparar y «Marcar listo» en En preparación (≥ 48 px). Mientras la petición va, el botón queda deshabilitado (sin doble clic). La tarjeta cambia de columna con la respuesta del back, sin esperar al canal. Un **409** explica «Otro operador ya cambió este pedido» y refresca. | Confirmar cada cambio (más lento en hora pico; el back no permite deshacer). |
| DP-05 | **Cancelar** como acción secundaria en Por preparar y En preparación (no en Listos): confirmación en línea con campo **Motivo** obligatorio (1–200, contador) y aviso de que se reembolsa al cliente. 409 explica que el pedido ya no se puede cancelar. | Sin cancelar desde cocina. |
| DP-06 | **En vivo:** canal `GET /kitchen/stream` con el mismo cliente SSE; el proveedor del 003b se generaliza (URL y consultas a invalidar). Mismas reglas: reconexión, 60 s de silencio, respaldo con sondeo de 15 s si el canal no está conectado, indicador «En vivo». | Solo sondeo. |
| DP-07 | **Aviso de pedido nuevo:** anuncio accesible «Nuevo pedido #N» y contador en el título de la pestaña («(3) Cocina»); **sin sonido** en este incremento. | Sonido opcional (necesita un clic previo por las reglas del navegador). |
| DP-08 ✅ | **Espera larga marcada con texto e ícono** («Lleva 12 min»): umbrales de 5 min en Por preparar y 15 min en En preparación (confirmados por ti), definidos como constantes fáciles de cambiar. En «Listos» se marca pasados 10 min. | Sin marca de espera. |
| DP-09 ✅ | **Datos del cliente:** nombre y teléfono visibles solo para el personal en esta pantalla (decisión tuya: la cocina puede necesitar validar algo con el cliente). No se guardan fuera de la caché de la pantalla. | Mostrar solo el nombre. |
| DP-10 | **Diseño para tablet y escritorio:** columnas amplias, tipografía legible a distancia, solo tokens de color, sin bloquear el zoom, sin desborde horizontal desde 360 px (pestañas). | — |

## 6. Rutas y comportamiento

| Ruta | Quién | Qué muestra |
|---|---|---|
| `/operador/cocina` | Operador | Tablero de cocina en vivo. |

**Reglas**
- Al abrir, se piden las tres colas; con el canal en vivo no hay sondeo periódico (D-052). Cada evento del canal vuelve a consultarlas.
- **Pedido nuevo** = un pedido en Por preparar que no estaba antes (excepto en la primera carga): se anuncia y suma al contador del título hasta que la pestaña se mira de nuevo.
- Al ejecutar una acción con éxito, se actualiza la caché con la respuesta; el pedido pasa de columna sin parpadear y el canal confirma después.
- Un pedido que otro operador mueve o cancela desaparece/cambia de columna cuando llega el evento; si justo se estaba cancelando o moviendo, el 409 lo explica.
- Si el total de una columna supera 100, se avisa («Mostrando los 100 más antiguos de N»).
- Vacío: «No hay pedidos por preparar» (y equivalentes).

**Ciclo de un pedido en cocina:** recibido → *Por preparar* → «Empezar» → *En preparación* → «Marcar listo» → *Listos* → (un repartidor lo toma en una ronda: `en_camino`, ya fuera de la cocina) → entregado. «Listos» nunca guarda pedidos entregados.

**Fechas:** hora de Bogotá (America/Bogota); el tiempo transcurrido se calcula con `createdAt` (y con el último evento para En preparación).

**Seguridad:** solo operador y admin; el back impone el permiso. El teléfono del cliente se muestra únicamente a ese personal; el motivo de cancelación se envía como texto y se muestra al cliente en su detalle (003).

## 7. Criterios de aceptación

| ID | Criterio (verificable) |
|---|---|
| CA-01 | `/operador/cocina` solo la ve el operador y `/admin/cocina` solo el admin (visitante → login; otros roles → su panel); «Cocina» queda habilitado en la navegación de ambos y desaparece de «Próximamente». |
| CA-02 | Las tres columnas salen de `GET /kitchen/orders?status=…`, ordenadas del más antiguo al más nuevo, con contador; en pantallas estrechas se ven como pestañas. «Listos» muestra tarjetas compactas, los 10 más antiguos y «Ver los N listos» para el resto; un pedido que sale de «listo» (lo toma un repartidor) desaparece de la columna. |
| CA-03 | La tarjeta muestra número, tiempo de espera, productos con cantidad y componentes de combos, nota (si hay), zona/punto/piso y nombre y teléfono del cliente; no muestra precios ni datos de pago. |
| CA-04 | «Empezar» llama a `start`; la tarjeta pasa a En preparación con la respuesta del back; «Marcar listo» llama a `ready` y la pasa a Listos. El botón se deshabilita mientras dura y un doble clic envía una sola petición. |
| CA-05 | 409 en `start`/`ready` muestra «Otro operador ya cambió este pedido» y refresca la cola; 404 muestra que el pedido ya no existe y lo quita; red/5xx muestran «Reintentar» sin perder el estado de la pantalla. |
| CA-06 | Cancelar pide motivo (obligatorio, 1–200, con contador) y avisa del reembolso; envía `POST /orders/{id}/cancel {reason}`; el pedido sale de la cola; no existe en Listos; 409 explica y refresca; 400 muestra el mensaje del back. |
| CA-07 | En vivo: un pedido nuevo o un cambio hecho por otro operador aparece en menos de 3 s sin recargar (E2E con el mock); con el canal caído, el sondeo de 15 s mantiene la pantalla al día; indicador «En vivo» / «Reconectando…». |
| CA-08 | Aviso de pedido nuevo: anuncio `aria-live` «Nuevo pedido #N» y contador en el título de la pestaña; la carga inicial no lo dispara; el contador se limpia al volver a mirar la pestaña. |
| CA-09 | La espera larga se marca con texto e ícono pasados 5 min (Por preparar) y 15 min (En preparación); el tiempo transcurrido se refresca cada 30 s. |
| CA-10 | Los cambios de cocina se ven en el seguimiento del cliente (003b) abierto en otro navegador (E2E con dos contextos). |
| CA-11 | Accesibilidad: columnas y pestañas con roles y nombres, botones con nombre que incluye el número de pedido, foco gestionado tras cada acción, estados con texto + ícono, contraste AA, botones ≥ 48 px, sin desborde en 360 px. |
| CA-12 | Solo tokens de color; `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `audit` y `e2e` en verde. |
| CA-13 | Pruebas: unitarias (tiempo transcurrido y umbrales, agrupación por estado, detección de pedidos nuevos, mapeo de errores de cocina), de componente (tarjeta, tablero, cancelar) y E2E contra el mock (empezar, listo, cancelar, 409, en vivo, dos contextos). |

## 8. Verificación contra el back real

Con el back local, el seed y el usuario `operador` (clave en el `.env` del back); el paso 1 también se puede repetir con `admin` en `/admin/cocina`:
1. Crear un pedido como cliente (003) con el detalle abierto en otra ventana; en `/operador/cocina` debe aparecer en «Por preparar» en menos de 3 s, con el aviso «Nuevo pedido #N» y el contador en el título.
2. «Empezar»: pasa a «En preparación» y el cliente ve «En preparación» sin recargar.
3. «Marcar listo»: pasa a «Listos» y el cliente ve «Listo».
4. Crear otro pedido y cancelarlo con motivo: el cliente ve «Cancelado» con el motivo y «Reembolsado», y el saldo vuelve al menú.
5. Conflicto: con dos pestañas de cocina, «Empezar» el mismo pedido en ambas: la segunda muestra «Otro operador ya cambió este pedido».
6. **P-05 (kitchen):** con la pestaña de red, copiar un evento `order` del canal de cocina (opcional).

## 9. Riesgos y pendientes

- **«Marcar agotado», inventario y movimientos** (rol operador, handoff §3) irán en el **incremento 004b**, justo después de este; hasta entonces «Productos» e «Inventario» siguen «Próximamente».
- **Columna «Listos»:** solo tiene lo que espera al repartidor (los demás ya salieron de la cocina); si el reparto se atrasa, las tarjetas compactas y el tope de 10 evitan llenar la pantalla.
- **Umbrales de espera** (5 y 15 min) son provisionales (DP-08).
- **Límite de 5 canales por usuario:** una cocina con varios equipos del mismo usuario puede agotarlos; el respaldo con sondeo lo cubre.
- **Sin deshacer:** un «Marcar listo» equivocado no se puede revertir desde el front (el back no lo ofrece); por eso las acciones son claras y grandes pero sin confirmación (DP-04, a tu criterio).
- **Un solo operador conectado en la práctica:** el 409 por competencia entre operadores se prueba con el mock y en la verificación manual (§8, paso 5).

## 10. Siguiente paso

`plan.md` → tu visto bueno → `tasks.md` → código y pruebas; me detengo para tu revisión.
