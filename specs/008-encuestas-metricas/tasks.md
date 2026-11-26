# Tareas 008 — Admin: encuestas y panel de métricas

**Spec:** `spec.md` v2 · **Plan:** `plan.md`. Una tarea se marca `[x]` solo con evidencia real.

## Fase 1 — Mock
- [x] T-01 `tests/mock-api/insights.ts`: datos sembrados y reglas del OpenAPI.
- [x] T-02 Rutas `GET /metrics` y `GET /surveys` (solo admin) en `server.mts`.
- [x] T-03 `insights.test.ts` (4): ceros diarios, sin datos, zona, validaciones, orden y filtros de encuestas.

## Fase 2 — Lógica
- [x] T-04 `src/lib/metrics/` (periodo, formato, hook) y `src/lib/surveys/` (filtros, hook) con pruebas (13).

## Fase 3 — Pantallas
- [x] T-05 Tokens de gráfica + `charts.tsx` (Recharts) cargado aparte.
- [x] T-06 Panel de métricas: filtros, seis secciones, tablas, vacíos y errores.
- [x] T-07 Encuestas: lista, filtros, paginación, enlaces.
- [x] T-08 Rutas y navegación (0 «Próximamente»).
- [x] T-09 Pruebas de componente: métricas (10) y encuestas (8).

## Fase 4 — Verificación
- [x] T-10 `e2e/metrics.spec.ts` (6 × 2 proyectos).
- [x] T-11 `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `audit`; E2E completo.
- [x] T-12 Capturas de escritorio y 360 px revisadas.
- [ ] T-13 **Tuyo:** prueba manual contra el back real (P-15).
