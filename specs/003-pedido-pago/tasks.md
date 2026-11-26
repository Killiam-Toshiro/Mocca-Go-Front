# Tareas 003 — Pedido y pago

Plan: `plan.md` (aprobado el 2026-11-10).

- [x] T-01 Mock: zonas, crear/listar/consultar/cancelar pedido, 402/409, idempotencia y controles (`tests/mock-api/orders.ts`, `server.mts`) con pruebas
- [x] T-02 Utilidades puras: tarjeta, cuerpo del pedido, huella, estados, fechas/WhatsApp, errores — CA-03, CA-04, CA-08
- [x] T-03 Idempotencia y borrador (`attempt.ts`, `draft.ts`, `session-store.ts`) — CA-08, CA-11
- [x] T-04 Datos: opción `headers` y `handleUnauthorized` en `requestJson`; `useZones`, `useCreateOrder`, `useOrders`, `useOrder`, `useCancelOrder` — CA-05, CA-12, CA-14
- [x] T-05 Piezas del formulario: `CardField`, `DeliveryFields`, `OrderSummary`, `Select` — CA-02, CA-03
- [x] T-06 `CheckoutView`, ruta `/cliente/pedido` y «Continuar» activo — CA-01, CA-04 a CA-11, CA-17
- [x] T-07 «Mis pedidos»: `StatusBadge`, `OrderRow`, `OrdersView`, ruta y navegación — CA-12, CA-17
- [x] T-08 Detalle: `OrderTimeline`, `CourierCard`, `CancelOrder`, `OrderDetailView`, ruta — CA-13 a CA-16
- [x] T-09 E2E `checkout.spec.ts` y `orders.spec.ts` (escritorio y móvil 360 px); capturas — CA-01 a CA-18
- [x] T-10 Verificación final y `docs/commits/003.md` — CA-19, CA-20
- [ ] T-11 Verificación manual contra el back real (spec §8)

## Desviaciones respecto al plan
- La huella del intento usa solo los **últimos 4 dígitos** de la tarjeta (no un hash SHA-256 del número): más simple, síncrona y sin tocar el número completo.
- El enfoque del campo de tarjeta tras un 402 se aplica cuando termina el envío (los campos siguen deshabilitados mientras dura).
- `CancelOrder` recibe el estado y conserva el aviso del 409 aunque el pedido pase a «en preparación».
- El panel de bienvenida (`RolePanel`) solo lista secciones aún no construidas; ya no muestra «Mis pedidos».
