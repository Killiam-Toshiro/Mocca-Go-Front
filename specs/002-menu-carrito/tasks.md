# Tareas 002 — Menú y carrito

**Spec:** aprobada el 2026-11-10 · **Plan:** aprobado el 2026-11-10. Marcar cada tarea al terminarla, con su evidencia. Paradas para consultar al usuario: decisiones de diseño o de producto importantes (pedido del usuario) y al final.

## A. Mock, utilidades, lógica y almacén
- [x] T-01 Mock con menú realista: `tests/mock-api/menu.ts` (20 productos, 3 combos, 2 agotados), `GET /menu` → `{ data }`, `behavior.menuStatus`, control `POST /__mock/menu` y `/__mock/menu/reset` — CA-17
  - Evidencia: las pruebas de pasarela y rutas que usan el mock siguen en verde (265 en `src/lib/server`, `src/app`, `src/lib/menu`, `src/lib/cart`).
- [x] T-02 `format.ts` (`$4.500`, manual porque `Intl` cambia el espacio según el entorno) y `categories.ts` (etiquetas, orden, categoría desconocida) con pruebas — CA-01, CA-02, CA-06
- [x] T-03 `cart.ts` puro: límites, `addLine`, `setQuantity`, `removeLine`, `parseCart`/`serializeCart` (zod), `reconcile`, `pruneRetired`, `acknowledgePrices`, con pruebas — CA-05, CA-06, CA-07, CA-08
  - Desviación de la spec: cada línea guarda también `name` (para mostrar el carrito si el menú no carga y avisar de productos retirados).
- [x] T-04 `storage.ts` (respaldo en memoria), `store.ts` (almacén externo, evento `storage`, avisos y anuncios) y `use-cart.ts` con pruebas — CA-07, CA-14, CA-15
- [x] T-05 `use-menu.ts` con pruebas (200, 429, 502, 504) — CA-14
  - Desviación del plan: usa `requestJson` con los tipos generados (no `openapi-fetch`), para poder simular `fetch` en pruebas.
  - Evidencia bloque A: `tsc`, `eslint`, `prettier` en verde; 58 pruebas nuevas.

## B. Interfaz
- [x] T-06 `DialogPanel` (`<dialog>` lateral y centrado: foco, Escape, fondo, devolver foco) con pruebas — CA-15
- [x] T-07 `CategoryIcon`, `ProductCard`, `CategoryChips`, `MenuView` (estados cargando/vacío/error, filtro, `canOrder`) con pruebas — CA-01, CA-02, CA-03, CA-11, CA-14
- [x] T-08 `ProductDetail` (descripción, componentes, cantidad 1–10, «Agregar») con pruebas — CA-04
- [x] T-09 `QuantityStepper`, `CartPanel`, `CartButton`, `CartBar`, `CartAnnouncer` con pruebas — CA-05, CA-06, CA-08, CA-11, CA-12, CA-15

## C. Integración
- [x] T-10 `SiteHeader`, `/` y `/cliente/menu`, «Menú» habilitado en `NAV`; adaptar pruebas existentes y `e2e/home.spec.ts` — CA-13
- [x] T-11 `useLogout` vacía el carrito (el vencimiento de sesión no) con prueba — CA-10

## D. Verificación
- [x] T-12 E2E `menu.spec.ts` y `cart.spec.ts` (escritorio y móvil 360 px); capturas para revisión visual — CA-01 a CA-15
- [x] T-13 Verificación final (`format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `audit`, `e2e`), revisión CA por CA y `docs/commits/002.md` — CA-16, CA-17
- [ ] T-14 Verificación manual contra el back real (spec §8)

**Al terminar:** detenerse para revisión del usuario. No hacer commit ni push sin que lo pida.
