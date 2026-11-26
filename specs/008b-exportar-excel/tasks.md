# Tareas 008b — Exportar métricas y encuestas a Excel

**Spec:** `spec.md` v2 · **Plan:** `plan.md`. Una tarea se marca `[x]` solo con evidencia real.

## Fase 0 — Dependencia
- [x] T-00 `exceljs@4.4.0` exacta; `overrides` de `uuid` 11.1.1; `npm audit --omit=dev` = 0 y un libro de prueba se escribe bien.

## Fase 1 — Lógica
- [x] T-01 `cells`, `filename`, `sheet` (formatos, encabezado fijo, filtros).
- [x] T-02 `metrics-workbook` y `export-metrics` (cinco hojas).
- [x] T-03 `fetch-all-surveys` (100 en 100, tope, sin repetidos, cancelable) y `surveys-workbook`/`export-surveys`.
- [x] T-04 `requestJson` con `signal`; `surveysUrl` con `limit`.
- [x] T-05 Pruebas unitarias (24): se escribe el `.xlsx` real y se lee de vuelta.

## Fase 2 — Interfaz
- [x] T-06 `ExportControls` y `useExportJob` (avance, cancelar, errores, doble clic).
- [x] T-07 Botón en Métricas (solo con datos cargados) y en Encuestas (solo con respuestas).
- [x] T-08 Pruebas de componente (7).

## Fase 3 — Verificación
- [x] T-09 `e2e/export.spec.ts` (4 × 2): descarga real, lectura del archivo, carga diferida, filtros.
- [x] T-10 `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `audit`; E2E completo.
- [ ] T-11 **Tuyo:** abrir los archivos en tu Excel y probar con el back real (P-16).
