# Plan 008 — Admin: encuestas y panel de métricas

**Spec:** `spec.md` (v2, DP-01 a DP-10 aprobados el 2026-11-12; DP-03 con librería de gráficas) · **Estado:** aprobado e implementado · **Siguiente paso:** tu prueba manual y revisión (`docs/commits/008.md`)

---

## 1. Enfoque
Una dependencia nueva (`recharts@3.10.1`, exacta) y ningún cambio en el back. Se reutilizan `requestJson`/`describeApiError`, `Alert`, `Select`, `Input`, `Label`, `Pagination`, `Skeleton`, `useAdminZones` (007c) y `formatCOP`/`categoryLabel` (007b). Orden: **mock** → **lógica** → **gráficas y pantallas** → **navegación** → **E2E** → verificación y documentos.

## 2. Hallazgos que condicionan el plan
1. **Rutas listas:** `GET /metrics` y `GET /surveys` ya están en `routes.generated.ts`; no hay que tocar la pasarela.
2. **Recharts pesa (~103 KB gzip):** va en un trozo aparte con `React.lazy`, así solo lo baja el panel de métricas.
3. **Los colores solo por tokens:** se añaden `--chart-main/good/bad/neutral` a `globals.css` y a `tokens.test.ts` (3:1 sobre la tarjeta).
4. **Las gráficas no son accesibles por sí solas:** cada una va en un `role="img"` descrito y con sus datos en una tabla.
5. **La URL manda** (periodo, zona, filtros de encuestas y página) con `useSearchParams` + `router.replace`; las páginas envuelven la vista en `Suspense`.
6. **«Próximamente» desaparece del admin:** el panel de inicio oculta esa sección cuando no queda nada futuro; se actualizan `nav.test.ts`, `app-shell.test.tsx` y `role-panel.test.tsx`.
7. **Los 400 del back no tienen texto fijo en el OpenAPI:** el cliente valida antes de enviar y el mock usa textos aproximados (P-15).

## 3. Archivos
- **Mock:** `tests/mock-api/insights.ts` (+ `insights.test.ts`), rutas en `server.mts`, `tests/utils/url.ts` (URL simulada para pruebas).
- **Lógica:** `src/lib/metrics/{types,period,format,use-metrics}.ts` (+ pruebas), `src/lib/surveys/{filters,use-surveys}.ts` (+ prueba).
- **Pantallas:** `src/components/metrics/{charts,lazy-charts,parts,sections,metrics-filters,metrics-view}.tsx`, `src/components/surveys-admin/{survey-row,surveys-view}.tsx`; páginas `app/(app)/admin/{metricas,encuestas}/page.tsx`; `nav.ts`, `role-panel.tsx`.
- **E2E:** `e2e/metrics.spec.ts`.
