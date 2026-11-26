# Plan 007b — Admin: catálogo y combos

**Spec:** `spec.md` (v2, aprobada el 2026-11-11, DP-01 a DP-12) · **Estado:** aprobado el 2026-11-11 e implementado · **Siguiente paso tras aprobar:** `tasks.md` → código y pruebas

---

## 1. Enfoque

Sin dependencias nuevas ni cambios en el back. Se reutiliza: `requestJson`/`ApiError`/`describeApiError`, `FormField`, `Input`, `Select`, `Alert`, `DialogPanel`, `Pagination`, `Skeleton`, `useDebouncedValue`, el patrón de hooks de 007a y las etiquetas de estado de `lib/inventory` (D-066).

Orden: **mock** → **lógica y hooks** → **pantalla** → **ruta y navegación** → **E2E** → verificación y documentos.

## 2. Hallazgos que condicionan el plan

1. **Rutas ya listas:** las 8 operaciones de `products` están en `routes.generated.ts`; se fija con pruebas en `route.test.ts`.
2. **El mock de productos vive en `inventory.ts`** (`listProducts` sin filtros, `setSoldOut`, movimientos) y el menú sale de `menu.ts`. Hay que unificar: el catálogo escrito por el admin debe verse en menú, inventario y «Productos» del operador (CA-11).
3. **`['products']` lo usa el operador** (`use-products.ts`, trae hasta 100 y quita el costo); el catálogo del admin usa su propia clave `['catalog', params]` con paginación y **sí** conserva costo (D-115); tras cualquier cambio se invalidan `['catalog']`, `['products']` y `['menu']`.
4. **Los combos no admiten movimientos** (D-071): en la fila del admin no hay «Registrar movimiento».
5. **Selector de componentes:** `GET /products?active=true&limit=100&search=` y se descartan los combos en el cliente; con búsqueda con espera.
6. **Navegación:** «Catálogo» pasa de «Próximamente» a habilitado: `nav.test.ts` y `app-shell.test.tsx` (las «Próximamente» del admin bajan de 5 a 4).

## 3. Archivos

**Mock (`tests/mock-api/`)**
- `inventory.ts`/`menu.ts` + nuevo `catalog.ts`: filtros `search`/`active`/`category`/`page`/`limit`; `create` (simple y combo, validaciones y textos del back, suma por defecto, costo calculado), `update`, `setStatus`, `replaceComponents`, `remove` (409 con movimientos o como componente); el menú se deriva del mismo almacén. `catalog.test.ts`.
- `server.mts`: `POST /products`, `PATCH /products/:id`, `PATCH /products/:id/status`, `PUT /products/:id/components`, `DELETE /products/:id` (solo admin; 403 al resto); `GET /products` con filtros.

**Lógica (`src/lib/catalog/`)**
- `types.ts`, `categories.ts` (etiquetas, simples vs combo).
- `schemas.ts`: `productSchema` (SKU con patrón, nombre, descripción, categoría, precio, costo), `comboSchema` (componentes 2–10, distintos, cantidad 1–10, precio opcional), `changedProductFields(original, values)`, `comboTotals(components)` (suma y costo).
- `errors.ts`: `describeCatalogError(error, context)` → duplicado de SKU, errores por campo, componentes, 404/409 con el texto del back.
- `use-catalog.ts` (`CATALOG_PAGE_SIZE = 20`, `keepPreviousData`), `use-component-options.ts`.
- `use-create-product.ts`, `use-update-product.ts`, `use-replace-components.ts`, `use-set-status.ts`, `use-delete-product.ts`: sin reintento, marca síncrona, recuperación por `GET /products?search=<sku>` tras corte de red, invalidaciones de DP-11.
- Interruptor «agotado»: se reutiliza `use-sold-out.ts`.

**Componentes (`src/components/catalog/`)**
- `catalog-view.tsx` (título, «Crear», filtros, lista, `Pagination`, esqueleto, error con «Reintentar», vacío, `aria-live` «N resultados»).
- `catalog-filters.tsx`, `catalog-list.tsx` (filas con estado en palabras + ícono, precio COP, costo y `costPercent`, etiqueta «Combo» con componentes), `product-panel.tsx` (crear/editar), `combo-builder.tsx` (selector, cantidades, suma y costo en vivo, aviso de precio), `status-confirm.tsx` y `delete-confirm.tsx` (confirmación en línea), `catalog-notice.tsx` («Entendido»).

**Ruta y navegación**
- `app/(app)/admin/catalogo/page.tsx` (+ `metadata`); `lib/auth/nav.ts`; `nav.test.ts`, `app-shell.test.tsx`, `role-panel.test.tsx` si aplica.

**Pruebas**
- Unitarias: `schemas.test.ts`, `errors.test.ts`, `hooks.test.tsx` (parámetros, cuerpo exacto, sin reintento, corte, doble clic).
- Componente: `catalog-view.test.tsx`, `product-panel.test.tsx`, `combo-builder.test.tsx`.
- `route.test.ts`: operaciones de productos del admin por la pasarela.
- `e2e/catalog.spec.ts` (escritorio y 360 px).

## 4. Mapa CA → pruebas

| CA | Pruebas |
|---|---|
| CA-01 | `nav.test.ts`, `app-shell.test.tsx`; E2E de guardas. |
| CA-02/03 | `catalog-view.test.tsx` (esqueleto, error, vacío, «N resultados», página 1 al filtrar), `hooks.test.tsx` (URL), E2E. |
| CA-04 | `schemas.test.ts`, `product-panel.test.tsx`, `hooks.test.tsx` (cuerpo exacto, 409 de SKU), E2E. |
| CA-05 | `schemas.test.ts` (`comboTotals`, 2–10, distintos), `combo-builder.test.tsx`, `hooks.test.tsx` (sin `cost`), E2E. |
| CA-06 | `schemas.test.ts` (`changedProductFields`, `null`), `product-panel.test.tsx`, E2E. |
| CA-07 | `combo-builder.test.tsx` (aviso de precio), `errors.test.ts`, E2E (componente inactivo → 400 explicado, composición intacta). |
| CA-08 | `catalog-view.test.tsx` (confirmación; cancelar no envía; aviso de combo afectado), E2E. |
| CA-09 | `catalog-view.test.tsx`, `errors.test.ts`, E2E (cada 409 y 404). |
| CA-10 | `hooks.test.tsx` (doble clic, sin reintento, corte con y sin efecto), E2E con `page.route`. |
| CA-11 | E2E (el producto del admin aparece en el menú del cliente y en «Productos» del operador). |
| CA-12/13 | Pruebas de componente (etiquetas, `aria-describedby`, `aria-live`, foco); E2E 360 px sin desborde y objetivos ≥ 48 px, capturas que reviso yo. |
| CA-14/15 | `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `audit` en local; E2E completo en la nube. |

## 5. Orden de trabajo

1. **Mock:** `catalog.ts` + pruebas; rutas y filtros; que el resto siga en verde.
2. **Lógica:** tipos, esquemas, errores, hooks, con pruebas.
3. **Pantalla:** lista y filtros → panel de crear/editar → constructor de combos → confirmaciones de estado y eliminar → ruta y navegación, con pruebas.
4. `route.test.ts` y E2E (escritorio y 360 px), capturas.
5. Verificación completa, `tasks.md`, decisiones, `docs/commits/007b.md`, README. **Me detengo para tu revisión; sin commit ni push.**

## 6. Riesgos

- **Mock vs back real:** textos y reglas salen del código del back; se corrige el mock tras tu prueba manual (P-11).
- **Precio de combos desactualizado:** el back no lo recalcula; el front avisa, no corrige.
- **Dos listas de productos** (`['catalog']` y `['products']`): se invalidan juntas para no mostrar datos viejos.
- **Doble envío y carreras:** marca síncrona; 409/404 explicados y lista refrescada.
- **Foco y anuncios:** foco al panel al abrir y a la fila al cerrar; resultados por `aria-live` sin mover el foco.

## Siguiente paso

Tu visto bueno a este plan → `tasks.md` → código y pruebas.
