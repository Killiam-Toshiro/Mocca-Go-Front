# Plan 008b — Exportar métricas y encuestas a Excel

**Spec:** `spec.md` (v2, DP-01 a DP-09 aprobados el 2026-11-12) · **Estado:** aprobado e implementado · **Siguiente paso:** tu prueba manual y revisión (`docs/commits/008b.md`)

---

## 1. Enfoque
Una dependencia nueva (`exceljs@4.4.0`, exacta) y ningún cambio en el back. Todo se arma en el navegador con datos que el back ya autorizó. Orden: **dependencia** → **lógica y pruebas** → **botones** → **E2E** → verificación y documentos.

## 2. Hallazgos que condicionan el plan
1. **ExcelJS arrastra `uuid` 8.3.2 con un aviso moderado de `npm audit`:** se fija `uuid` 11.1.1 con `overrides` (compatible: ExcelJS solo usa `v4`) y el audit queda en 0; se comprueba escribiendo un libro.
2. **ExcelJS pesa ~248 KB gzip:** carga diferida con `import()` al pulsar; el E2E comprueba que no se descarga antes del clic.
3. **`requestJson` no se podía cancelar:** se le añadió `signal` opcional (si se aborta, se lanza el motivo del aborto en vez de un error de red).
4. **`surveysUrl` fijaba 20 por página:** ahora acepta `limit` (la exportación usa 100).
5. **Excel no guarda zona horaria:** las horas se escriben como «hora de pared» de Colombia (instante −5 h).
6. **Texto de personas como fórmula:** se neutraliza con `safeText` en todos los campos de texto libre o administrables.

## 3. Archivos
- **Lógica:** `src/lib/export/{cells,filename,sheet,metrics-workbook,surveys-workbook,fetch-all-surveys,export-metrics,export-surveys,download,use-export-job}.ts` (+ pruebas), `tests/utils/xlsx.ts` (lee el `.xlsx` generado).
- **UI:** `src/components/export/export-controls.tsx`; integrado en `metrics-view.tsx` y `surveys-view.tsx`.
- **E2E:** `e2e/export.spec.ts`.
