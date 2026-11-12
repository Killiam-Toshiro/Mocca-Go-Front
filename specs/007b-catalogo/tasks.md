# Tareas 007b — Admin: catálogo y combos

**Spec:** `spec.md` v2 · **Plan:** `plan.md` (aprobado el 2026-11-11). Una tarea se marca `[x]` solo con evidencia real (prueba o comando ejecutado).

## Fase 1 — Mock
- [x] T-01 `tests/mock-api/inventory.ts`: `createProduct`, `updateProduct`, `setStatus`, `replaceComponents`, `removeProduct` con las reglas y textos del back; costo calculado del combo; menú solo con productos activos.
- [x] T-02 `server.mts`: `POST /products`, `PATCH|DELETE /products/:id`, `PATCH /products/:id/status`, `PUT /products/:id/components` (solo admin).
- [x] T-03 `inventory.test.ts` (4 pruebas nuevas) y el resto del mock en verde (54).

## Fase 2 — Lógica
- [x] T-04 `src/lib/catalog/`: tipos, categorías, esquemas (`createBody`, `changedFields`, `comboTotals`), errores.
- [x] T-05 `use-catalog`, `useComponentOptions`, `useCombosWith` y acciones (crear, editar, recomponer, estado, agotado, eliminar) con recuperación tras corte; pruebas (26).

## Fase 3 — Pantalla
- [x] T-06 `CatalogView`, filtros, lista, paginación.
- [x] T-07 Panel: crear (producto/combo), editar, composición, eliminar; confirmaciones de estado y eliminar.
- [x] T-08 Ruta `/admin/catalogo`, navegación; `catalog-view.test.tsx` (21) y pruebas de navegación actualizadas.

## Fase 4 — Pasarela y E2E
- [x] T-09 `route.test.ts` (3 pruebas del catálogo) y `e2e/catalog.spec.ts` (12 × 2 proyectos).

## Fase 5 — Cierre
- [x] T-10 `format:check`, `lint`, `typecheck`, `api:check`, `test` (991), `build`, `check:bundle`, `audit --omit=dev`.
- [ ] T-11 E2E completo en la nube (ver `docs/commits/007b.md`).
- [x] T-12 Decisiones D-114 a D-118 y P-11, README.
- [x] T-13 `docs/commits/007b.md`. **Me detengo para tu revisión; sin commit ni push.**
