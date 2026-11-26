# Tareas 007d — Admin y operador: pedidos y rondas

**Spec:** `spec.md` v2 · **Plan:** `plan.md` (aprobado el 2026-11-12). Una tarea se marca `[x]` solo con evidencia real (prueba o comando ejecutado).

## Fase 1 — Mock
- [x] T-01 `orders.ts`: `listAll`, `getAny`; `cancelStaff` con los textos del back. `dispatch.ts`: `listAllRounds`, `getAnyRound`. `server.mts`: rutas de personal.
- [x] T-02 Pruebas del mock (`orders.test.ts`, `dispatch.test.ts`): 58 en verde.

## Fase 2 — Lógica
- [x] T-03 `src/lib/staff-orders/` (filtros, formato, `useStaffOrders`, `useStaffOrder`) y `src/lib/staff-rounds/` (filtros, `useStaffRounds`, `useStaffRound`, sondeo de 15 s solo con pestaña visible).
- [x] T-04 `useKitchenCancel` también invalida `['staff-orders']` y `['staff-order']`.
- [x] T-05 Pruebas: `filters.test.ts`, `hooks.test.tsx` (pedidos y rondas, incluida la de pestaña oculta y desmontaje).

## Fase 3 — Pantallas y rutas
- [x] T-06 `src/components/staff-orders/` (pantalla con canal de cocina, lista, fila, detalle con cancelar) y `src/components/staff-rounds/` (lista, fila con «Atrasada N min», detalle).
- [x] T-07 Ocho páginas (`admin|operador` × `pedidos`, `pedidos/[id]`, `rondas`, `rondas/[id]`) y navegación (admin: Pedidos habilitado + Rondas; operador: Pedidos y Rondas).
- [x] T-08 Pruebas de componente (12), navegación actualizada y `route.test.ts` (3 nuevas).

## Fase 4 — E2E
- [x] T-09 `e2e/staff-orders.spec.ts` (3 × 2 proyectos) y `e2e/staff-rounds.spec.ts` (2 × 2).

## Fase 5 — Cierre
- [x] T-10 `format:check`, `lint`, `typecheck`, `api:check`, `test` (1020), `build`, `check:bundle`, `audit --omit=dev`.
- [x] T-11 E2E completo en la nube: 265 pasaron, 1 omitido.
- [x] T-12 Decisiones D-119 a D-123 y P-12, README.
- [x] T-13 `docs/commits/007d.md`. **Me detengo para tu revisión; sin commit ni push.**
