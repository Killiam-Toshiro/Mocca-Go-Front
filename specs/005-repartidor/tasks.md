# Tareas 005 — Repartidor

Plan: `plan.md` (aprobado el 2026-11-10).

- [x] T-01 Mock de despacho con los textos y reglas del back real (`tests/mock-api/dispatch.ts`, rutas, usuario `repartidor2`, controles `/__mock/dispatch`) + `dispatch.test.ts` — CA-16
- [x] T-02 Lógica pura: `selection`, `rounds`, `contact`, `errors` con pruebas — CA-03, CA-04, CA-09, CA-10
- [x] T-03 Datos: `useDispatchQueue`, `useActiveRounds`, `useCreateRound`, `useCloseOrder`, `useNewReadyOrders` con pruebas — CA-05, CA-07, CA-08, CA-11, CA-12
- [x] T-04 Interfaz de la cola: zonas, selección, barra de salir, avisos — CA-02, CA-03, CA-04, CA-14
- [x] T-05 Interfaz de rondas: ronda, pedido, confirmación de entrega, no entregado — CA-06 a CA-10, CA-14
- [x] T-06 Rutas `(despacho)`, canal compartido y navegación — CA-01, CA-11
- [x] T-07 Pruebas de componente (`queue-view`, `rounds-view`) — CA-16
- [x] T-08 E2E `dispatch.spec.ts` (7 casos × escritorio y 360 px) — CA-01, CA-05, CA-11, CA-13, CA-14
- [x] T-09 Verificación completa y `docs/commits/005.md` — CA-15
- [ ] T-10 Verificación manual contra el back real (spec §8; la haces tú)

## Desviaciones respecto al plan
- Se verificó el contrato leyendo el código del back (Anexo A del plan): P-07 queda resuelto (409, no 404) y apareció el matiz de `skip_locked` en la sugerencia.
- `usePrepareDay`-style: `useCreateRound` y `useCloseOrder` son hooks propios (no `useMutation`) para decidir tras un corte de red consultando el estado.
- La elección de pedidos se **depura al renderizar** contra la cola (`prune`) en lugar de con un efecto; el aviso de «ya no está listo» dura hasta la siguiente acción.
- `ReasonField` (004c) gana el parámetro `max` (el motivo de despacho es de 200, el de inventario de 300) y ahora aplica `maxLength`.
- Mock: el `scope` por repartidor y el segundo repartidor (`repartidor2`) no existen en el back; solo aíslan las pruebas E2E en paralelo.
- El E2E de «en vivo» usa el mock en vez de la cocina real; y el 409 por pedido tomado se prueba con `page.route` que corta el canal (si no, el canal en vivo lo corrige antes del clic).
