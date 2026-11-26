# Tareas 004c — Producción del día

Plan: `plan.md` (aprobado el 2026-11-10).

- [x] T-01 Vocabulario (`labels.ts`: «Disponibles», «Producción», «Merma o salida») y motivos sugeridos (`reason-field.tsx`) en formulario, filas e historial — CA-01
- [x] T-02 Lógica pura `day-plan.ts` (`parseTarget`, `buildPlan`, `summarize`, `targetErrors`) con pruebas — CA-02, CA-03
- [x] T-03 Hook `usePrepareDay` (consulta fresca, un movimiento por producto en serie, resultados por fila, sin reintento, se detiene al salir) con pruebas — CA-04, CA-05, CA-06
- [x] T-04 UI «Preparar el día» (`prepare-day.tsx`, `prepare-row.tsx`) como tercera sección de `InventoryView` — CA-02, CA-03, CA-08
- [x] T-05 Pruebas de componente (`prepare-day.test.tsx`, 7) y de vocabulario en `inventory-view.test.tsx` — CA-10
- [x] T-06 E2E: vocabulario actualizado y caso «preparar el día» (lote, 409 parcial, historial, 360 px) — CA-07, CA-08, CA-10
- [x] T-07 Verificación completa y `docs/commits/004c.md` — CA-09
- [ ] T-08 Verificación manual contra el back real (spec §8; la haces tú)

## Desviaciones respecto al plan
- `run()` devuelve además el mapa de resultados de la tanda; la pantalla lo usa para vaciar solo los campos aplicados u omitidos.
- Al iniciar una tanda se conservan solo los resultados ambiguos de la anterior (las filas por revisar siguen bloqueadas hasta «Ya lo revisé»).
- Un 5xx se trata como ambiguo (igual que un corte de red), no como error corregible: solo los 4xx dejan el campo para reintentar.
- El estado del lote (campos y motivo) vive en `InventoryView`, así sobrevive al cambiar de sección.
- La barra «Revisar cambios» queda pegada abajo (`sticky`) para alcanzarla en 360 px.
- Mock de pruebas: `fakeInventoryBack` acepta `failMovementFor` (fallo por producto).
