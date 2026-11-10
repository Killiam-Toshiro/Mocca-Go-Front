# Plan 004 — Cocina

**Spec:** `specs/004-cocina/spec.md` (aprobada el 2026-11-10) · **Estado del plan:** borrador, pendiente de tu aprobación

Vocabulario: **cola** = los pedidos de un estado (`recibido`, `en_preparacion`, `listo`) que trae `GET /kitchen/orders`. **Tablero** = las tres colas juntas. **Canal** = la conexión SSE a `/api/kitchen/stream`.

## 1. Enfoque técnico

| Bloque | Qué se construye | Archivos clave |
|---|---|---|
| A. Canal genérico | El proveedor del 003b se divide: `LiveChannelProvider({ url, invalidate, open })` abre el canal, expone `useLiveStatus()` y vuelve a consultar las claves indicadas ante `ready`/`order` (misma lógica de 45 s oculta, 401, etc.). `OrdersLiveProvider` pasa a ser un envoltorio con las claves de pedidos y los anuncios del cliente. `useLiveStatus` y `LiveStatus` se re-exportan desde `orders/live` para no tocar lo hecho. | `src/lib/live/channel.tsx`, `src/lib/orders/live.tsx` |
| B. Lógica pura de cocina | `waitMinutes(since, now)`, `sinceFor(order)` (recibido: `createdAt`; en preparación y listo: la hora del último evento con ese estado), `waitLabel` («hace 8 min»), `isLongWait(status, minutes)` con las constantes 5, 15 y 10 min, `visibleReady(orders, expanded)` (10 más antiguos), `moveOrder(queues, order, to)` y `describeKitchenError(error)` → `{ kind: 'conflict' \| 'missing' \| 'validation' \| 'network' \| 'other', messages }`. | `src/lib/kitchen/board.ts`, `errors.ts` |
| C. Datos | `useKitchenQueue(status)` (`GET /api/kitchen/orders?status=…&limit=100`, clave `['kitchen', status]`; sondeo de 15 s solo si el canal no está `live`); `useKitchenBoard()` agrupa las tres; `useKitchenAction('start' \| 'ready')` (mutación `POST /api/kitchen/orders/{id}/…`, al terminar **mueve** el pedido entre colas en la caché con la respuesta y luego invalida; 409/404 solo invalidan); `useKitchenCancel()` (`POST /api/orders/{id}/cancel` con `{ reason }`, quita el pedido de la cola e invalida). Sin reintento automático en mutaciones. | `src/lib/kitchen/use-kitchen-queue.ts`, `use-kitchen-action.ts`, `use-kitchen-cancel.ts` |
| D. Reloj y avisos | `useNow(30_000)` (hora actual refrescada cada 30 s, para los «hace X min»). `useNewKitchenOrders()` se suscribe a la caché de `['kitchen', 'recibido']`: la primera carga solo registra los ids; los ids nuevos generan el anuncio «Nuevo pedido #N» y, si la pestaña está oculta, suman al contador del título («(3) Cocina»), que se limpia al volver a verla. | `src/lib/kitchen/use-now.ts`, `use-new-orders.ts` |
| E. Interfaz | `KitchenScreen` (proveedor del canal + vista), `KitchenView` (encabezado, `LiveBadge`, región `aria-live`, pestañas en pantallas estrechas y tres columnas desde `lg`), `KitchenColumn`, `KitchenCard` (completa: número, espera, productos y componentes, nota resaltada, entrega, nombre y teléfono `tel:`, acciones), `ReadyCard` (compacta), `WaitBadge` (texto + ícono), `CancelKitchenOrder` (confirmación en línea con **Motivo** obligatorio de 1–200 y contador; aviso de reembolso). Tras una acción el foco va a la tarjeta en su nueva columna y se anuncia el cambio. | `src/components/kitchen/*` |
| F. Rutas y navegación | `/operador/cocina` y `/admin/cocina` (páginas finas con `KitchenScreen`); `NAV.operador` habilita «Cocina» y `NAV.admin` suma «Cocina» habilitada; el panel de bienvenida deja de listarla en «Próximamente». | `src/app/(app)/operador/cocina/page.tsx`, `admin/cocina/page.tsx`, `src/lib/auth/nav.ts` |
| G. Mock y pruebas | El mock gana: `GET /kitchen/orders` (solo operador y admin; filtro `status`, más antiguo primero, paginado), `POST /kitchen/orders/:id/start|ready` (409 si el estado no corresponde, 404), `POST /orders/:id/cancel` para el personal (`reason` obligatorio, solo recibido y en preparación) y `GET /kitchen/stream` (un canal por conexión; recibe `ready` y un `order` por cada pedido nuevo, cambio o cancelación de **cualquier** cliente). | `tests/mock-api/orders.ts`, `server.mts` |

### Decisiones técnicas del plan

- **Sin tipos a mano:** `OrderResponse` y `OrderPageResponse` ya salen de `schema.d.ts`; la cocina reutiliza `Order` y `isFinalStatus`/`statusInfo`.
- **El canal se abre solo en la pantalla de cocina** (el proveedor va en la página, no en el layout del rol): el admin y el operador no abren canal en sus otras secciones.
- **Mover en caché, luego confirmar:** al terminar una acción se actualiza la caché con la respuesta del back (la tarjeta cambia de columna al instante) y se invalida para que el back confirme; si el canal ya trajo el cambio, la invalidación no duplica nada porque las colas se reemplazan completas.
- **Sin parpadeos al invalidar:** las colas conservan los datos anteriores mientras se consulta (`placeholderData` implícito de TanStack Query con la misma clave).
- **Sin setState dentro de efectos** (regla del proyecto): los avisos y el contador usan la suscripción a la caché con `setState` en el callback, igual que los anuncios del cliente; el título se actualiza en un efecto sin estado.
- **Acciones con una sola petición:** el botón se deshabilita mientras la mutación está pendiente y el manejador ignora un segundo clic.
- **Tarjetas accesibles:** cada botón incluye el número («Empezar pedido 1012»); las columnas son regiones con encabezado; las pestañas siguen el patrón `tablist`/`tab`/`tabpanel` con flechas.
- **Teléfono:** se muestra el valor del back tal cual como enlace `tel:` solo si contiene dígitos y `+`; si no, como texto.

## 2. Dependencias y versiones

Ninguna nueva (TanStack Query 5.107.1, lucide-react 1.70.0, herramientas de prueba existentes).

## 3. Estructura de archivos

```
src/
  lib/
    live/      channel.tsx (+ prueba)           # proveedor genérico
    orders/    live.tsx (envoltorio), use-order.ts, use-orders.ts (sin cambios de comportamiento)
    kitchen/   board.ts, errors.ts, use-kitchen-queue.ts, use-kitchen-action.ts, use-kitchen-cancel.ts,
               use-now.ts, use-new-orders.ts (+ pruebas)
    auth/nav.ts                                  # «Cocina» operador y admin
  components/
    kitchen/   kitchen-screen.tsx, kitchen-view.tsx, kitchen-column.tsx, kitchen-card.tsx,
               ready-card.tsx, wait-badge.tsx, cancel-kitchen-order.tsx (+ pruebas)
  app/(app)/   operador/cocina/page.tsx, admin/cocina/page.tsx
tests/mock-api/  orders.ts, server.mts
e2e/             kitchen.spec.ts
docs/            decisions.md (D-055…D-064), commits/004.md
```

## 4. Mapa CA → pruebas

| CA | Prueba |
|---|---|
| CA-01 | `nav.test.ts` (Cocina habilitada en operador y admin); `role-panel.test.tsx`; E2E: visitante a `/operador/cocina` → login, cliente → su panel, operador y admin entran a su ruta. |
| CA-02 | `board.test.ts` (orden, `visibleReady` 10 y «Ver los N»); `kitchen-view.test.tsx` (tres columnas con contador, pestañas en estrecho, «Listos» compacto, un pedido que sale de la cola desaparece). |
| CA-03 | `kitchen-card.test.tsx`: número, espera, productos y componentes, nota, entrega, nombre y teléfono (`tel:`); no hay precios ni pago. |
| CA-04 | `hooks.test.tsx` y `kitchen-view.test.tsx`: `start`/`ready` mueven la tarjeta con la respuesta, botón deshabilitado, doble clic = una petición. E2E: empezar y marcar listo. |
| CA-05 | `errors.test.ts` y `kitchen-view.test.tsx`: 409 («Otro operador ya cambió este pedido» y refresca), 404 (lo quita), red («Reintentar»). E2E 409 con dos pestañas. |
| CA-06 | `cancel-kitchen-order.test.tsx`: motivo obligatorio y contador, cuerpo `{ reason }`, no hay botón en Listos, 409 y 400. E2E: cancelar y ver «Cancelado» en el seguimiento del cliente. |
| CA-07 | `channel.test.tsx` (invalida `['kitchen']` ante eventos; respaldo); E2E: un pedido creado por un cliente aparece en «Por preparar» en menos de 3 s; un cambio de otro operador aparece sin recargar. |
| CA-08 | `use-new-orders.test.tsx`: la primera carga no avisa, un id nuevo anuncia y, con la pestaña oculta, suma al título; se limpia al volver; E2E del anuncio. |
| CA-09 | `board.test.ts` (umbrales 5/15/10 y etiqueta); `kitchen-card.test.tsx` con reloj falso: el tiempo avanza cada 30 s y aparece la marca de espera larga. |
| CA-10 | E2E con dos contextos: cocina cambia el estado y el seguimiento del cliente (003b) lo muestra sin recargar. |
| CA-11 | Pruebas de componente con roles y nombres (`tablist`, botones con número), foco tras la acción; E2E en 360 px sin desborde y botones ≥ 48 px. |
| CA-12 | `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `npm audit`, E2E completo. |
| CA-13 | El conjunto anterior (unitarias, de componente y E2E del mock). |

## 5. Orden de implementación (cada paso termina en verde: `tsc`, `eslint`, `prettier`, pruebas)

1. Canal genérico (`live/channel.tsx`) y `OrdersLiveProvider` como envoltorio; las pruebas del 003b siguen pasando.
2. Mock: cocina (listar, empezar, listo, cancelar por personal, canal de cocina) con pruebas del almacén.
3. Lógica pura (`board.ts`, `errors.ts`) con pruebas.
4. Datos: colas, acciones, cancelar; reloj y avisos de pedido nuevo, con pruebas de hooks.
5. Interfaz: tarjetas, columnas, pestañas, cancelar, vista y pantalla; pruebas de componente.
6. Rutas, navegación y panel de bienvenida; pruebas de navegación.
7. E2E `kitchen.spec.ts` (escritorio y 360 px) y revisión visual con capturas.
8. Verificación completa, `tasks.md` y `docs/commits/004.md`; parar para tu revisión.

## 6. Riesgos técnicos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Pruebas E2E en paralelo comparten el mock y la cocina ve los pedidos de todos | Cada prueba busca **sus** pedidos por número; al terminar mueve los suyos a `entregado` con el control del mock para no ensuciar «Listos»; las pruebas del mismo archivo van en serie. |
| «Listos» crece si el reparto se atrasa | Tarjetas compactas, tope de 10 y botón «Ver los N listos» (D-056). |
| Dos operadores actúan a la vez (409) | Mensaje claro, refresco y prueba con dos pestañas; el back es la fuente de verdad. |
| Cambiar a un proveedor genérico rompe el 003b | Primer paso del plan: las 40 pruebas de canal y proveedor del 003b deben seguir en verde antes de seguir. |
| El evento `order` de cocina no está documentado | No se usa su contenido (D-049); cada evento vuelve a consultar las tres colas. |
| Cocina con la pantalla siempre abierta y varios equipos con el mismo usuario (límite de 5 canales) | 429 → respaldo con sondeo de 15 s y el indicador lo dice. |
| Pestaña de cocina en segundo plano deja de actualizar el reloj | Al volver a ser visible se recalcula `now` y se consultan las colas. |
| Teléfono con formato inesperado | Solo se enlaza con `tel:` si tiene la forma esperada; si no, texto plano. |

## 7. Fuera de plan

Agotados e inventario (004b); rondas y despacho (005); listado general de pedidos del admin (007); sonidos y notificaciones; imprimir comandas; métricas.
