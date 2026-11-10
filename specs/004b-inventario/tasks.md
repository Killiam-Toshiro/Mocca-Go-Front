# Tareas 004b — Productos agotados e inventario

Plan: `plan.md` (aprobado el 2026-11-10).

- [x] T-01 Mock: catálogo con saldo, `GET /products`, `PATCH /products/:id/sold-out`, `POST/GET /movements`, menú público derivado y controles `/__mock/inventory*` (`inventory.ts` + `inventory.test.ts`) — CA-02, CA-05
- [x] T-02 Lógica pura: `availability`, `movement`, `errors`, `format` con pruebas — CA-03, CA-06, CA-07
- [x] T-03 Datos: `useProducts`, `useSetSoldOut`, `useCreateMovement`, `useMovements` con pruebas — CA-04, CA-06, CA-08, CA-09
- [x] T-04 «Productos»: filtros, fila, estado, vista — CA-02, CA-03, CA-04
- [x] T-05 «Inventario»: saldos, formulario de movimiento, historial — CA-06, CA-07, CA-08
- [x] T-06 Rutas y navegación (operador: Productos e Inventario; admin: Inventario) — CA-01
- [x] T-07 Pruebas de componente (`products-view`, `inventory-view`) — CA-12
- [x] T-08 E2E `inventory.spec.ts` (escritorio y 360 px) — CA-01, CA-05, CA-06, CA-07, CA-10
- [x] T-09 Verificación completa y `docs/commits/004b.md` — CA-11, CA-12
- [ ] T-10 Verificación manual contra el back real (spec §8, incluye P-06; la haces tú)

## Desviaciones respecto al plan
- `useNow` no se tocó: «Actualizado hace N s» usa un reloj propio (`useTicker(ms)` en `src/lib/inventory/use-ticker.ts`) porque `useNow` es un almacén único de 30 s.
- Lista en lugar de tabla en pantallas anchas: cada producto es una fila con rejilla (`md:grid-cols`), no un `<table>`.
- Se agregaron `product-list.tsx` (carga/error/vacío/«más de 100» compartidos) y `use-filtered-products.ts`.
- Tras un corte de red al registrar, el botón «Registrar» queda deshabilitado y solo quedan «Ver historial» y «Cancelar» (no hay «Reintentar»); el 4xx sí deja corregir y reenviar.
- Los avisos de 404 viven en la pantalla (con «Entendido»), no en la fila (D-058); el resultado de agotar y de registrar se muestra en una línea `role="status"`.
- El historial muestra «Automático · pedido …abc123» (últimos 6 caracteres del `orderId`), sin enlace ni número (D-072).
