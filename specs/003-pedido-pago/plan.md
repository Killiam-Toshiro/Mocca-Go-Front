# Plan 003 — Pedido y pago

**Spec:** `specs/003-pedido-pago/spec.md` (aprobada el 2026-11-10) · **Estado del plan:** borrador, pendiente de tu aprobación

Vocabulario: **borrador** = punto, piso y notas recordados en `sessionStorage`. **Intento** = una compra con su `Idempotency-Key`. **Huella** = resumen (hash) del contenido del pedido para saber si cambió entre intentos. **Estado final** = `entregado`, `cancelado` o `no_entregado`.

## 1. Enfoque técnico

| Bloque | Qué se construye | Archivos clave |
|---|---|---|
| A. Utilidades puras | Tarjeta: `formatCardNumber` (solo dígitos, grupos de 4, máx. 16), `cardDigits`, `isValidCard`. Pedido: `buildOrderBody(cart, form)` (omite `floor`/notas vacías, `cardNumber` sin espacios), `orderFingerprint(...)` (huella sin el número completo: usa los últimos 4 y un hash del resto), `parseOrderForm` con zod (punto obligatorio, piso según `floors`, notas ≤ 200). Estados: etiqueta, ícono y si es final (`ORDER_STATUS`). Fechas: `formatOrderDate` (es-CO, America/Bogota). `safeWhatsappUrl`. | `src/lib/orders/card.ts`, `body.ts`, `fingerprint.ts`, `status.ts`, `format.ts` (+ pruebas) |
| B. Idempotencia y borrador | `attempt.ts`: guarda `{key, fingerprint}` en `sessionStorage` (`mocca-go:order-attempt:v1`); `getAttemptKey(fingerprint)` devuelve la clave guardada si la huella coincide o crea un UUID nuevo (`crypto.randomUUID`); `clearAttempt()`. `draft.ts`: `{pointId, floor, deliveryNote, note}` en `mocca-go:order-draft:v1`, validado con zod y con respaldo en memoria si `sessionStorage` falla. **Nunca** se guarda la tarjeta. | `src/lib/orders/attempt.ts`, `draft.ts` (+ pruebas) |
| C. Datos (TanStack Query) | `useZones()` (`GET /delivery-zones`, `staleTime` 60 s); `useCreateOrder()` (mutación: `POST /orders` con `Idempotency-Key`; sin reintento automático; no pone el cuerpo en la caché: el `variables` de la mutación se descarta al terminar con `gcTime: 0`); `useOrders()` (`useInfiniteQuery`, 10 por página, «Ver más»); `useOrder(id)` (consulta cada 15 s si no es final y al volver a la pestaña); `useCancelOrder(id)` (actualiza la caché con la respuesta). Todas con `requestJson` (igual que `useMenu`), tipos de `schema.d.ts`. `requestJson` gana una opción `headers`. | `src/lib/orders/use-zones.ts`, `use-create-order.ts`, `use-orders.ts`, `use-order.ts`, `use-cancel-order.ts`; `src/lib/api/json.ts` |
| D. Mapeo de errores | `describeOrderError(error)` → `{ kind: 'card' \| 'conflict' \| 'validation' \| 'rate' \| 'network' \| 'other', messages }` (402 → tarjeta; 404/409 → conflicto; 400 → validación con mensajes del back; 429; 0/502/504 → red). | `src/lib/orders/errors.ts` (+ pruebas) |
| E. Formulario de pedido | `CheckoutView` (cliente): resumen (de `reconcile`), `DeliveryFields` (zona, punto, pista, piso, indicación y nota con contador), `CardField` (con ayuda y «Usar tarjeta de prueba»), total estimado, botón «Pagar $X» deshabilitado mientras envía. Foco al primer error; avisos con `role="alert"` o anunciados. En éxito: `clearCart()`, `clearAttempt()`, `clearDraft()`, `router.replace('/cliente/pedidos/[id]?nuevo=1')`. En 409/404: `queryClient.invalidateQueries(['menu'])` y `['zones']`; `syncWithMenu`. Carrito vacío → `router.replace('/cliente/menu')` con aviso. | `src/components/orders/checkout-view.tsx`, `delivery-fields.tsx`, `card-field.tsx`, `order-summary.tsx` |
| F. Mis pedidos | `OrdersView`: lista con `OrderRow` (número, fecha, `StatusBadge`, total, cantidad de productos), «Ver más», vacío con enlace al menú, error con «Reintentar», esqueletos. | `src/components/orders/orders-view.tsx`, `order-row.tsx`, `status-badge.tsx` |
| G. Detalle | `OrderDetailView`: aviso `?nuevo=1` («¡Pedido #N recibido!», anunciado y con foco), productos y componentes, entrega, pago (`last4`, estado), `OrderTimeline` (de `events`, estado actual resaltado), repartidor y ETA cuando vengan, motivos de cancelación/no entrega, `CancelOrder` (confirmación en línea; 409 explica y refresca), «No encontramos este pedido» en 404. | `src/components/orders/order-detail-view.tsx`, `order-timeline.tsx`, `cancel-order.tsx`, `courier-card.tsx` |
| H. Rutas y navegación | `/cliente/pedido`, `/cliente/pedidos`, `/cliente/pedidos/[id]` (páginas finas dentro del layout del cliente); «Mis pedidos» habilitado en `NAV`; `CartPanel`: «Continuar» del cliente deja de estar deshabilitado, cierra el panel y navega a `/cliente/pedido` (D-034 cumplido); sigue bloqueado si hay agotados. | `src/app/(app)/cliente/pedido/page.tsx`, `pedidos/page.tsx`, `pedidos/[id]/page.tsx`; `src/lib/auth/nav.ts`; `src/components/cart/cart-panel.tsx` |
| I. Mock y pruebas | El mock gana: `GET /delivery-zones` (2 zonas, 5 puntos; uno con pisos, otro sin), `POST /orders` (valida cuerpo; `Idempotency-Key` repetida devuelve el mismo pedido con 200; tarjeta `4000000000000002` → 402; producto agotado → 409; descuenta nada, es simulado), `GET /orders` (paginado, solo del cliente de la sesión), `GET /orders/:id` (404 si es de otro), `POST /orders/:id/cancel` (409 si no está en «recibido»), y controles fuera de `/api/v1`: `POST /__mock/orders/:id/status` (avanza el estado y agrega un evento; en «en_camino» agrega `courier` y `etaAt`) y `POST /__mock/orders/reset`. | `tests/mock-api/orders.ts`, `server.mts`; `e2e/checkout.spec.ts`, `e2e/orders.spec.ts` |

### Decisiones técnicas del plan

- **Sin tipos a mano:** `OrderResponse`, `CreateOrderDto`, `PublicZoneResponse` salen de `schema.d.ts`.
- **El número de tarjeta jamás sale del estado del formulario.** Se pasa a la mutación solo en el momento de enviar; la mutación usa `gcTime: 0` y no se escribe en ninguna otra parte; la huella usa los últimos 4 + un hash SHA-256 (`crypto.subtle`) del número, sin guardar el número. Una prueba revisa `localStorage`, `sessionStorage` y la caché de consultas después de pagar y después de un error (CA-10).
- **Doble envío:** el botón se deshabilita en cuanto empieza la mutación y el manejador ignora un segundo envío mientras `isPending` (cubre Enter repetido).
- **Qué cuenta como «mismos datos»:** huella = productos y cantidades + `pointId` + `floor` + notas + hash de la tarjeta. Si cambia, clave nueva (el back podría rechazar la misma clave con otro cuerpo).
- **Reintento seguro:** tras red/5xx se conserva la clave del intento; tras 402/409/404/400 también se conserva (los datos son los mismos), y cambia sola si el cliente modifica algo.
- **Consulta periódica provisional:** `refetchInterval` 15 s solo si el estado no es final; 003b la sustituye por SSE sin tocar las vistas (el hook `useOrder` es el único punto que cambia).
- **Redirección sin parpadeo:** la validación de «carrito vacío» ocurre tras montar (el carrito es vacío en el servidor, ver spec 002); mientras tanto se muestra un esqueleto, no una redirección.
- **Zona horaria:** formateo con `Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota', dateStyle: 'medium', timeStyle: 'short' })`.
- **Colores:** solo tokens; estados con `--secondary`, `--destructive`, `--brand-strong` y `--primary`, sin tokens nuevos salvo que `tokens.test.ts` lo exija.
- **Pasarela:** las rutas de pedidos, `delivery-zones` y la cabecera `Idempotency-Key` ya están permitidas en `routes.generated.ts` y `forward.ts`; no se toca. Se verifica que un 402 y un 409 del back lleguen intactos al navegador (prueba de pasarela).

## 2. Dependencias y versiones

**Ninguna nueva.** `zod` (formularios y almacenamiento), `lucide-react` (íconos de estado: `ClipboardCheck`, `ChefHat`, `PackageCheck`, `Bike`, `CircleCheck`, `CircleX`, `Ban`, `CreditCard`, `MapPin`), `@tanstack/react-query` (`useInfiniteQuery`), `crypto.subtle` y `crypto.randomUUID` del navegador.

## 3. Estructura de archivos

```
src/
  lib/
    orders/   card.ts, body.ts, fingerprint.ts, attempt.ts, draft.ts, status.ts, format.ts, errors.ts,
              use-zones.ts, use-create-order.ts, use-orders.ts, use-order.ts, use-cancel-order.ts (+ pruebas)
    api/json.ts          # opción headers
    auth/nav.ts          # habilita «Mis pedidos»
  components/
    orders/   checkout-view.tsx, delivery-fields.tsx, card-field.tsx, order-summary.tsx,
              orders-view.tsx, order-row.tsx, status-badge.tsx,
              order-detail-view.tsx, order-timeline.tsx, cancel-order.tsx, courier-card.tsx
    cart/cart-panel.tsx  # «Continuar» activo para el cliente
  app/(app)/cliente/    pedido/page.tsx, pedidos/page.tsx, pedidos/[id]/page.tsx
tests/mock-api/  orders.ts, server.mts
e2e/             checkout.spec.ts, orders.spec.ts
docs/            decisions.md (D-037…D-046), commits/003.md
```

## 4. Mapa CA → pruebas

| CA | Tipo | Archivo |
|---|---|---|
| CA-01 | componente + E2E | `cart-panel.test.tsx` (cliente: «Continuar» navega y cierra), `checkout-view.test.tsx` (carrito vacío → menú), `e2e/checkout.spec.ts` (visitante y admin no llegan) |
| CA-02 | componente | `delivery-fields.test.tsx` (zona → punto → piso obligatorio solo si hay pisos; pista) |
| CA-03 | unitaria + componente | `card.test.ts` (formato, validación), `card-field.test.tsx` («Usar tarjeta de prueba») |
| CA-04 | unitaria + componente | `body.test.ts` (cuerpo exacto, omisiones), `checkout-view.test.tsx` (cabecera `Idempotency-Key` UUID v4) |
| CA-05 | componente + E2E | `checkout-view.test.tsx` (201 y 200: carrito vacío, navegación), `e2e/checkout.spec.ts` |
| CA-06 | componente + E2E | `checkout-view.test.tsx` (402 conserva todo), `e2e/checkout.spec.ts` (`4000 0000 0000 0002`) |
| CA-07 | componente + E2E | `checkout-view.test.tsx` (409/404 reconcilian), `e2e/checkout.spec.ts` (agotado entre medio con `/__mock/menu`) |
| CA-08 | unitaria + componente | `errors.test.ts`, `attempt.test.ts` (misma/nueva clave), `checkout-view.test.tsx` (400, 429, red + «Reintentar») |
| CA-09 | componente | `checkout-view.test.tsx` (doble clic y doble Enter → una petición) |
| CA-10 | componente | `checkout-view.test.tsx` (revisa `localStorage`, `sessionStorage`, caché y URL tras éxito y tras error) |
| CA-11 | unitaria + componente | `draft.test.ts` (validación, punto inexistente), `checkout-view.test.tsx` (recarga) |
| CA-12 | componente + E2E | `orders-view.test.tsx` (orden, «Ver más», vacío, error), `e2e/orders.spec.ts` |
| CA-13 | componente | `order-detail-view.test.tsx` (productos, componentes, pago, línea de tiempo, 404) |
| CA-14 | componente + E2E | `use-order.test.tsx` (intervalo solo si no es final), `e2e/orders.spec.ts` (`/__mock/orders/:id/status` y la pantalla cambia sin recargar) |
| CA-15 | componente + E2E | `cancel-order.test.tsx` (solo «recibido», confirmación, 409), `e2e/orders.spec.ts` |
| CA-16 | componente | `courier-card.test.tsx` (`wa.me` válido/ inválido), `order-detail-view.test.tsx` (motivos) |
| CA-17 | unitaria + componente | `nav.test.ts`, `checkout-view.test.tsx` (el carrito no se vacía antes del éxito) |
| CA-18 | componente + E2E | etiquetas y foco en `checkout-view.test.tsx`; E2E móvil 360 px sin desborde; `tokens.test.ts` |
| CA-19 | automática | `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `audit`, `e2e` |
| CA-20 | todas | el conjunto anterior |

## 5. Orden de implementación (cada paso termina en verde: `tsc`, `eslint`, `prettier`, pruebas)

1. **Mock** (`orders.ts`, `server.mts`): zonas, crear/listar/consultar/cancelar, 402/409, idempotencia, controles; prueba del mock.
2. **Utilidades puras:** `card.ts`, `body.ts`, `fingerprint.ts`, `status.ts`, `format.ts`, `errors.ts` con pruebas (primero las pruebas).
3. **Idempotencia y borrador:** `attempt.ts`, `draft.ts` con pruebas (sin `sessionStorage`, datos dañados).
4. **Datos:** opción `headers` en `requestJson`; `useZones`, `useCreateOrder`, `useOrders`, `useOrder`, `useCancelOrder` con pruebas.
5. **Piezas del formulario:** `CardField`, `DeliveryFields`, `OrderSummary` con pruebas.
6. **`CheckoutView`** y la ruta `/cliente/pedido`; «Continuar» activo en el carrito; pruebas de todos los errores, doble envío y secreto de la tarjeta.
7. **Mis pedidos:** `StatusBadge`, `OrderRow`, `OrdersView`, ruta y «Mis pedidos» en `NAV`; pruebas.
8. **Detalle:** `OrderTimeline`, `CourierCard`, `CancelOrder`, `OrderDetailView`, ruta; pruebas (incluye `?nuevo=1`, 404, 409).
9. **E2E** (`checkout.spec.ts`, `orders.spec.ts`) en escritorio y móvil 360 px; capturas para tu revisión visual.
10. **Verificación:** `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `audit`, E2E; CA por CA y `docs/commits/003.md`.

Parada para tu revisión después de los pasos 6 (formulario, con capturas), 8 (detalle) y 10 (final), o solo al final si prefieres.

## 6. Riesgos técnicos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Cobro doble por reintento o doble clic | Clave de idempotencia por intento (huella), botón deshabilitado y manejador que ignora el segundo envío; pruebas dedicadas. |
| El número de tarjeta se filtra a algún almacenamiento o caché | Vive solo en el estado del formulario; mutación con `gcTime: 0`; huella con hash; prueba que revisa `localStorage`, `sessionStorage`, caché y URL; el mock verifica que no llegue a ningún otro lugar. |
| El back rechaza reenviar la misma clave con otro cuerpo | La clave solo se reutiliza si la huella coincide; si no, es nueva. Se confirma en la prueba manual contra el back real (§8, paso 1–2). |
| El carrito guardado desactualizado produce 409/404 | Se reconcilia con el menú fresco y se explica; el carrito no se pierde. |
| 429 de `POST /orders` (10 por minuto por IP) | Mensaje claro y reintento manual; con Railway depende de `TRUST_PROXY_HOPS` (P-01, ya anotado). |
| Consulta cada 15 s multiplica peticiones | Solo con la pestaña visible y solo en estados no finales; 003b la reemplaza por SSE. |
| Redirección por «carrito vacío» antes de que cargue el carrito | Esqueleto hasta montar; la decisión se toma con el almacén ya leído. |
| Pasarela altera 402/409 | Prueba de pasarela con esos estados; el E2E contra el mock cubre el camino real por `/api/orders`. |
| Mock distinto del back real | Mismos campos que `OrderResponse`; la verificación manual contra el back real (spec §8) cierra la brecha. |

## 7. Fuera de plan

SSE y cambios instantáneos (003b); encuesta y perfil (006); cocina (004) y despacho (005); pasarela de pago real, guardar tarjetas, fecha/CVV; reintento y reembolso de `no_entregado`; filtros por estado en «Mis pedidos»; imprimir o compartir el pedido.
