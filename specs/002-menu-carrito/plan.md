# Plan 002 — Menú y carrito

**Spec:** `specs/002-menu-carrito/spec.md` (aprobada el 2026-11-10) · **Estado del plan:** aprobado el 2026-11-10

Vocabulario: **línea** = un producto del carrito con su cantidad. **Reconciliar** = cruzar las líneas guardadas con el menú actual. **Panel** = `<dialog>` modal (lateral o centrado).

## 1. Enfoque técnico

| Bloque | Qué se construye | Archivos clave |
|---|---|---|
| A. Utilidades del menú (puras) | `formatCOP` (D-035), etiquetas, orden e ícono por categoría (con respaldo para una categoría desconocida) y agrupar productos por categoría. | `src/lib/menu/format.ts`, `categories.ts` |
| B. Datos del menú | `useMenu()`: `useQuery(['menu'])` con `staleTime` 30 s y refresco al volver a la pestaña; llama a `GET /menu` con el cliente tipado y `unwrap`; devuelve `data` (la lista). | `src/lib/menu/use-menu.ts` |
| C. Lógica del carrito (pura, sin React) | Tipos y límites (10 unidades, 10 líneas); `addLine`, `setQuantity`, `removeLine`, `clearLines`; `parseCart` (zod: versión, líneas, cantidades enteras 1–10, sin duplicados, tope de líneas); `reconcile(lines, menu)` → por línea `ok` / `agotado` / `retirado` y `precioCambio`; `totals` (pesos enteros, solo disponibles) y `canContinue`. | `src/lib/cart/cart.ts` |
| D. Almacenamiento y estado | `storage.ts`: lee y escribe `mocca-go:cart:v1` con `try/catch` y respaldo en memoria. `store.ts`: almacén externo (`subscribe`, `getSnapshot`, `getServerSnapshot` vacío) que sincroniza pestañas con el evento `storage` y expone acciones. `useCart()` con `useSyncExternalStore`. | `src/lib/cart/storage.ts`, `store.ts`, `use-cart.ts` |
| E. Panel genérico | `DialogPanel` sobre `<dialog>` (variantes lateral y centrado): foco atrapado, Escape, clic en el fondo, devuelve el foco al disparador, bloquea el desplazamiento del fondo. Es el mismo patrón de `MobileNav`; no se refactoriza `MobileNav` en este incremento. | `src/components/ui/dialog-panel.tsx` |
| F. Menú | `MenuView` (chips de categoría, secciones, estados cargando / vacío / error con «Reintentar»), `ProductCard`, `CategoryIcon`, `ProductDetail` (panel con descripción, componentes, selector de cantidad y «Agregar»). Recibe `canOrder` (false para el personal: sin botones de agregar ni carrito). | `src/components/menu/*` |
| G. Carrito (interfaz) | `CartButton` (con cantidad), `CartPanel` (líneas, `QuantityStepper`, avisos de reconciliación, total, «Vaciar» con confirmación, botón «Continuar» según D-034), `CartBar` (barra inferior en móvil), `CartAnnouncer` (`aria-live`). | `src/components/cart/*` |
| H. Rutas | `/` pasa a ser el menú con `SiteHeader` (logo, y «Ingresar» / «Crear cuenta» o «Ir a mi panel» según `getSession`); `/cliente/menu` renderiza el mismo `MenuView` dentro de `AppShell`. «Menú» del cliente se habilita en `NAV`. | `src/app/(public)/page.tsx`, `src/app/(app)/cliente/menu/page.tsx`, `src/components/site-header.tsx`, `src/lib/auth/nav.ts` |
| I. Cerrar sesión | `useLogout` llama a `clearCart()` (D-030). Un vencimiento de sesión **no** vacía el carrito. | `src/lib/auth/use-logout.ts` |
| J. Mock y pruebas | El mock devuelve `{ data: [...] }` con 20 productos y 3 combos (los de la spec: capuchino `CAF-CAPU`, pandebono…), algunos agotados, y permite cambiar disponibilidad y precio en caliente para probar la reconciliación. | `tests/mock-api/server.mts`, `tests/mock-api/menu.ts` |

### Decisiones técnicas del plan

- **Un solo almacén de carrito para toda la app** (módulo con `useSyncExternalStore`), sin proveedor ni dependencia nueva (no `zustand`). En el servidor y en la hidratación el carrito es vacío, y se completa tras montar: no hay discrepancia de hidratación.
- **Aviso de precio nuevo:** cada línea guarda `seenPrice`. Si el menú trae otro precio se muestra un aviso con «Entendido» (que actualiza `seenPrice`). No bloquea; el total usa siempre el precio actual.
- **Dónde se mezcla menú y carrito:** `reconcile` es una función pura que recibe líneas y menú. Mientras el menú carga o falla, el carrito muestra las líneas sin precio actual con un aviso («No pudimos actualizar los precios») y `Continuar` queda bloqueado; **no se borra nada** por un error de red (CA-14).
- **Quién ve qué:** `canOrder` = visitante o cliente. En `/` el servidor ya conoce la sesión y lo pasa como propiedad; en `/cliente/menu` es siempre verdadero.
- **Anuncios accesibles:** una región `aria-live="polite"` única (`CartAnnouncer`) que lee los cambios del carrito («Capuchino agregado. Carrito: 2 productos»).
- **Foco:** al cerrar un panel el foco vuelve al botón que lo abrió; al agregar desde el detalle, el panel se cierra y se anuncia el cambio.
- **Datos:** no se escriben tipos a mano; `MenuItem` sale de `schema.d.ts`. Categoría desconocida → se muestra con su nombre en bruto y el ícono genérico.
- **Colores:** solo tokens (D-027). Los estados de aviso usan `--secondary`, `--destructive` y `--brand-strong`; no se añaden tokens nuevos salvo que alguna prueba de contraste lo exija.
- **Pasarela:** `GET /menu` ya es pública en `routes.generated.ts`; no se toca.

## 2. Dependencias y versiones

**Ninguna nueva.** Se usan `zod` 4.6.7 (validar el almacenamiento), `lucide-react` 1.70.0 (íconos `Coffee`, `CupSoda`, `Croissant`, `CakeSlice`, `Cookie`, `Sandwich`, `Package`, `ShoppingBasket`, `Plus`, `Minus`, `Trash2`, `TriangleAlert`, `RefreshCw`, ya comprobados), `@tanstack/react-query` 5.107.1 y `openapi-fetch` 0.17.0.

## 3. Estructura de archivos

```
src/
  lib/
    menu/    format.ts, categories.ts, use-menu.ts (+ pruebas)
    cart/    cart.ts, storage.ts, store.ts, use-cart.ts (+ pruebas)
    auth/    nav.ts (habilita /cliente/menu), use-logout.ts (vacía el carrito)
  components/
    ui/dialog-panel.tsx
    menu/    menu-view.tsx, category-chips.tsx, product-card.tsx, product-detail.tsx, category-icon.tsx
    cart/    cart-button.tsx, cart-panel.tsx, cart-bar.tsx, quantity-stepper.tsx, cart-announcer.tsx
    site-header.tsx
  app/
    (public)/page.tsx            # menú para todos (reemplaza la portada)
    (app)/cliente/menu/page.tsx  # el mismo menú dentro de AppShell
tests/mock-api/  menu.ts (datos), server.mts (GET /menu y ajustes en caliente)
e2e/             menu.spec.ts, cart.spec.ts (e2e/home.spec.ts se adapta)
docs/            decisions.md (D-028…D-036), commits/002.md
```

## 4. Mapa CA → pruebas

| CA | Tipo | Archivo |
|---|---|---|
| CA-01 | componente + E2E | `menu-view.test.tsx`, `e2e/menu.spec.ts` (sin sesión, esqueletos, `$4.500`) |
| CA-02 | componente + E2E | `category-chips.test.tsx`, `menu-view.test.tsx`, `e2e/menu.spec.ts` |
| CA-03 | componente + E2E | `product-card.test.tsx`, `e2e/menu.spec.ts` (agotado) |
| CA-04 | componente | `product-detail.test.tsx` (componentes del combo, cantidad 1–10) |
| CA-05 | unitaria + componente + E2E | `cart.test.ts` (límites), `cart-panel.test.tsx`, `e2e/cart.spec.ts` |
| CA-06 | unitaria | `cart.test.ts` (`totals`: precios y cantidades variados, excluye no disponibles), `format.test.ts` |
| CA-07 | unitaria + E2E | `cart.test.ts` (`parseCart`: dañado, versión, cantidades, duplicados), `storage.test.ts` (sin `localStorage`), `store.test.ts` (evento `storage`), `e2e/cart.spec.ts` (recarga y dos pestañas) |
| CA-08 | unitaria + componente + E2E | `cart.test.ts` (`reconcile`), `cart-panel.test.tsx`, `e2e/cart.spec.ts` (mock cambia disponibilidad y precio) |
| CA-09 | E2E | `e2e/cart.spec.ts` (visitante → «Ingresar para pedir» → login → carrito intacto) |
| CA-10 | componente + E2E | `use-logout.test.tsx`, `e2e/cart.spec.ts` |
| CA-11 | componente + E2E | `cart-panel.test.tsx` (cliente: «Continuar» deshabilitado), `menu-view.test.tsx` (personal: sin agregar), `e2e/menu.spec.ts` |
| CA-12 | E2E (móvil 360 px) | `e2e/menu.spec.ts` (sin desborde, barra inferior, objetivos de 44 px) |
| CA-13 | componente + E2E | `nav.test.ts`, `e2e/menu.spec.ts`, `e2e/home.spec.ts` actualizado |
| CA-14 | componente | `menu-view.test.tsx` (429, 502/504, «Reintentar»), `cart-panel.test.tsx` (menú caído no vacía el carrito) |
| CA-15 | componente + E2E | `dialog-panel.test.tsx` (foco, Escape), `cart-announcer`, E2E con teclado |
| CA-16 | automática | `tokens.test.ts`, `lint`, `typecheck`, `build`, `check:bundle`, CI; búsqueda de hex sueltos en `src/components` |
| CA-17 | todas | el conjunto anterior |

## 5. Orden de implementación (cada paso termina en verde: `tsc`, `eslint`, `prettier`, pruebas)

1. **Mock y datos de prueba:** `tests/mock-api/menu.ts` (20 productos, 3 combos, agotados), `GET /menu` con `{ data }` y ajustes en caliente; prueba del mock.
2. **Utilidades del menú:** `format.ts`, `categories.ts` y sus pruebas.
3. **Lógica del carrito:** `cart.ts` con pruebas de límites, `parseCart`, `reconcile` y `totals` (primero las pruebas).
4. **Almacenamiento y almacén:** `storage.ts`, `store.ts`, `use-cart.ts` y sus pruebas (sin `localStorage`, evento `storage`, hidratación).
5. **`useMenu`** con pruebas (carga, 429, 502).
6. **`DialogPanel`** con pruebas (foco, Escape, fondo).
7. **Menú:** `CategoryIcon`, `ProductCard`, chips, `MenuView` y sus pruebas (estados, filtro, agotado, `canOrder`).
8. **Detalle** del producto y pruebas.
9. **Carrito:** `QuantityStepper`, `CartPanel`, `CartButton`, `CartBar`, `CartAnnouncer`, con pruebas (límites, avisos, «Continuar» según rol).
10. **Rutas y cabecera:** `SiteHeader`, `/` y `/cliente/menu`, habilitar «Menú» en `NAV`; adaptar las pruebas existentes (`role-panel`, `app-shell`, `nav`, `home.spec.ts`).
11. **Cerrar sesión:** `clearCart()` en `useLogout` y su prueba.
12. **E2E** (`menu.spec.ts`, `cart.spec.ts`) en Chromium escritorio y móvil 360 px; revisión visual con capturas.
13. **Verificación:** `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `audit`, E2E; revisar CA por CA y redactar `docs/commits/002.md`.

Parada para tu revisión después de los pasos 6, 9 y 13 (si lo prefieres, solo al final).

## 6. Riesgos técnicos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Discrepancia de hidratación por leer `localStorage` | `getServerSnapshot` devuelve carrito vacío; el cliente se actualiza tras montar. Prueba de componente con almacenamiento lleno. |
| `localStorage` no disponible o lleno (modo privado) | Todo acceso con `try/catch` y respaldo en memoria; prueba dedicada. |
| Datos antiguos o manipulados en el almacenamiento | Validación con zod al leer; se descarta lo inválido; límites de líneas y cantidades. |
| `<dialog>` poco soportado por jsdom | Mismo parche de `showModal`/`close` ya usado en `app-shell.test.tsx`, movido a una ayuda compartida de pruebas. |
| Menú caído deja al carrito sin precios | El carrito se muestra con aviso y «Continuar» bloqueado; nunca se borra por un error de red. |
| El precio cambia entre agregar y pedir | Aviso con «Entendido»; el total real lo calcula el back (incremento 3). |
| Dos pestañas pisándose el carrito | Evento `storage`: gana la última escritura; prueba con dos páginas en el mismo contexto de Playwright. |
| Mock distinto del back real | Mismos campos que `MenuItemResponse`; la verificación manual contra el back real (spec §8) cierra la brecha. |

## 7. Fuera de plan

Punto de entrega, nota de cocina, pago y creación del pedido (incremento 3); fotos, tamaños, extras y búsqueda de texto; refactor de `MobileNav` para usar `DialogPanel`; modo oscuro; carrito en el servidor.
