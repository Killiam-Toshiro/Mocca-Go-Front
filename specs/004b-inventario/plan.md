# Plan 004b — Productos agotados e inventario

**Spec:** `specs/004b-inventario/spec.md` (aprobada el 2026-11-10) · **Estado del plan:** borrador, pendiente de tu aprobación

Vocabulario: **catálogo** = la lista de `GET /products`. **Saldo** = `stock`. **Movimiento** = una entrada (`IN`) o salida (`OUT`) del historial. **Estado** = la palabra que resume la disponibilidad (D-066).

## 1. Enfoque técnico

| Bloque | Qué se construye | Archivos clave |
|---|---|---|
| A. Lógica pura | `availability(product)` → `{ key, label }` (Disponible, Agotado, Sin saldo, Inactivo, «Falta saldo de un componente», «No disponible» como respaldo), `isCombo`, `matchesFilter` (búsqueda por nombre/SKU sin tildes ni mayúsculas, categoría, «Solo agotados o sin saldo»); `parseMovement(form, product)` valida tipo, cantidad entera ≥ 1 (sin decimales, ceros ni signos), motivo 1–300 con texto visible y sin NUL, y en salidas que no supere el saldo; `resultingStock`; `describeInventoryError` (404 «El producto ya no existe», 409 con el mensaje del back, 400, red ambigua, otros). | `src/lib/inventory/availability.ts`, `movement.ts`, `errors.ts` |
| B. Datos | `useProducts()` (`GET /api/products?limit=100`, clave `['products']`, `refetchInterval` 30 s solo con la pestaña visible, al volver a la pestaña, `placeholderData` para no parpadear); `useSetSoldOut()` (`PATCH /api/products/:id/sold-out`, cambia la fila en caché con la respuesta y reconsulta); `useCreateMovement()` (`POST /api/movements`, **sin reintentos**, con la respuesta ajusta el `stock` del producto en caché e invalida `['movements']`); `useMovements({ page, productId, type })` (`GET /api/movements`, 20 por página, clave `['movements', …]`). `useNow` admite el intervalo como parámetro para «Actualizado hace N s» (cada 5 s). | `src/lib/inventory/use-products.ts`, `use-sold-out.ts`, `use-movements.ts`, `use-create-movement.ts`, `src/lib/kitchen/use-now.ts` |
| C. Interfaz de «Productos» | `ProductsView`: buscador, filtro de categoría y de estado, `Freshness` («Actualizado hace N s» y «Actualizar»), lista de `ProductRow` (nombre, SKU, categoría, `StatusBadge`, saldo, botón «Marcar agotado Capuchino» / «Volver a vender Capuchino» ≥ 48 px). Tarjetas en 360 px y tabla desde `md`. Aviso `aria-live` «Capuchino ya no se puede pedir» / «Capuchino vuelve a venderse». Un 404 se avisa en un aviso de pantalla (como en cocina, D-058) y se reconsulta. | `src/components/inventory/products-view.tsx`, `product-row.tsx`, `status-badge.tsx`, `product-filters.tsx`, `freshness.tsx` |
| D. Interfaz de «Inventario» | `InventoryView` con dos botones de sección «Saldos» / «Historial» (`role="group"`, `aria-pressed`, igual que cocina). **Saldos:** mismos filtros; cada fila con «Registrar movimiento» (no en combos: «Saldo calculado»). **`MovementForm`** en línea bajo la fila: Entrada/Salida (radio), cantidad, motivo con contador, vista del saldo resultante en salidas, un botón «Registrar» con marca síncrona; conserva lo escrito ante errores; cierra y devuelve el foco al botón de la fila al terminar. **Historial:** `MovementHistory` con filtros de producto y tipo, paginación «Anterior / Siguiente», fecha America/Bogota, tipo con texto + ícono, cantidad con signo, motivo, responsable y, si hay `orderId`, «Automático · pedido …abc123» (D-072). | `inventory-view.tsx`, `stock-row.tsx`, `movement-form.tsx`, `movement-history.tsx` (en `src/components/inventory/`) |
| E. Rutas y navegación | `/operador/productos`, `/operador/inventario`, `/admin/inventario` (páginas finas, título de metadata); `NAV.operador` habilita «Productos» e «Inventario»; `NAV.admin` suma «Inventario» tras «Cocina». | `src/app/(app)/…`, `src/lib/auth/nav.ts` |
| F. Mock y pruebas | El mock gana un **catálogo** con saldo, `soldOut`, `active` y costo por producto (se construye desde el menú actual; saldo inicial 50 por producto simple), y `GET /menu` calcula `available` desde él (agotado, inactivo, sin saldo; combos por sus componentes), de modo que agotar un producto lo deshabilita para el cliente. Endpoints solo para operador y admin (403 al resto): `GET /products` (orden por SKU, `search`, `category`, `active`, paginado, con `cost` para probar que no se muestra), `PATCH /products/:id/sold-out`, `POST /movements` (400 si cantidad/motivo inválidos, 404, 409 para saldo insuficiente, máximo excedido, inactivo y **combo** (supuesto de P-06)), `GET /movements` (más reciente primero, filtros, paginado). Los pedidos del mock **no** descuentan saldo (se verifica en la prueba manual, paso 4). Controles `/__mock/inventory/*` para dejar el estado inicial. | `tests/mock-api/inventory.ts` (+ prueba), `server.mts`, `menu.ts` |

### Decisiones técnicas del plan

- **Sin tipos a mano:** `ProductResponse`, `MovementResponse`, `CreatedMovementResponse` y las páginas salen de `schema.d.ts`.
- **El catálogo se trae completo (`limit=100`) y se filtra en el navegador:** el menú real tiene ~25 productos, así que buscar y filtrar es instantáneo y la lista de «Registrar movimiento» no necesita otra consulta. Si `total` supera 100 se avisa «Mostrando los 100 primeros de T» (mismo patrón que cocina).
- **`cost` y `costPercent` nunca se leen** en los componentes; el tipo que usa la interfaz (`StaffProduct`) los omite, y una prueba verifica que no aparecen en pantalla (D-070).
- **Movimiento no idempotente (D-068):** `useMutation` con `retry: false`, marca síncrona con `useRef` (como en cocina) y botón deshabilitado; si el error es de red (`isUnreachable`) o 5xx, el mensaje es «No sabemos si se registró: revisa el historial antes de volver a intentarlo» y **no hay botón «Reintentar»** (solo «Ver historial»); un 4xx sí deja corregir y reenviar.
- **Salida mayor al saldo:** se bloquea en el formulario con el saldo conocido («Hay 12; no puedes sacar 20»), pero el back sigue siendo la autoridad: si el saldo cambió por otro lado, su 409 se explica igual.
- **Avisos de pantalla, no de fila (D-058):** al reconsultar la lista las filas se reordenan o desaparecen; los avisos de 404/409 viven en la vista.
- **Sondeo con pestaña visible:** TanStack Query no sondea en segundo plano por defecto (`refetchIntervalInBackground: false`); al volver se reconsulta por `refetchOnWindowFocus`.
- **Sin setState dentro de efectos** (regla del proyecto); el foco se maneja en manejadores y con `ref`.
- **Teclado y lector:** radios con grupo y nombre («Tipo de movimiento»), campos con etiqueta y error asociado (`aria-describedby`), `aria-live` para los resultados.
- **Pedido en el historial (D-072):** el movimiento solo trae `orderId`, y el personal aún no tiene pantalla de detalle de pedido (es del 007); por eso se muestra «Automático · pedido …» con los últimos 6 caracteres, sin consultas extra ni enlace. Cuando exista el detalle de personal se enlaza.

## 2. Dependencias y versiones

Ninguna nueva.

## 3. Estructura de archivos

```
src/
  lib/
    inventory/  availability.ts, movement.ts, errors.ts, use-products.ts, use-sold-out.ts,
                use-movements.ts, use-create-movement.ts (+ pruebas)
    kitchen/    use-now.ts (intervalo como parámetro)
    auth/       nav.ts (+ nav.test.ts)
  components/
    inventory/  products-view.tsx, product-row.tsx, status-badge.tsx, product-filters.tsx, freshness.tsx,
                inventory-view.tsx, stock-row.tsx, movement-form.tsx, movement-history.tsx (+ pruebas)
  app/(app)/    operador/productos/page.tsx, operador/inventario/page.tsx, admin/inventario/page.tsx
tests/mock-api/ inventory.ts (+ inventory.test.ts), server.mts, menu.ts
e2e/            inventory.spec.ts
docs/           decisions.md (D-065…D-074, P-06), commits/004b.md
```

## 4. Mapa CA → pruebas

| CA | Prueba |
|---|---|
| CA-01 | `nav.test.ts` (Productos e Inventario habilitados en operador; Inventario en admin); E2E: visitante → login, cliente → su panel, operador y admin entran a su ruta; operador en `/admin/inventario` → `/operador`. |
| CA-02 | `inventory.test.ts` del mock y `products-view.test.tsx` (búsqueda por nombre/SKU, filtro de categoría, filtro de estado, aviso de más de 100); una prueba verifica que no se ve costo ni margen. |
| CA-03 | `availability.test.ts` (cada combinación de `soldOut`, `active`, `stock`, `available`, combo) y `products-view.test.tsx` (texto + ícono y saldo). |
| CA-04 | `hooks.test.tsx` y `products-view.test.tsx`: `PATCH` con `{ soldOut }`, fila actualizada con la respuesta, anuncio `aria-live`, doble clic = una petición, 404 con aviso. |
| CA-05 | E2E con dos contextos: el operador agota un producto y el menú del cliente (tras recargar) lo muestra «Agotado» y no deja agregarlo; al volver a vender, se puede. |
| CA-06 | `movement.test.ts` (tipo, cantidad entera, motivo 1–300, salida ≤ saldo, saldo resultante) y `movement-form.test.tsx` (mensajes, cuerpo exacto `{ productId, type, quantity, reason }`, el saldo de la fila se actualiza con `stock`, doble clic = un solo `POST`). |
| CA-07 | `errors.test.ts` y `movement-form.test.tsx`: 409 y 404 sin perder lo escrito; error de red sin reintento automático y con el aviso de revisar el historial; E2E: salida mayor al saldo. |
| CA-08 | `movement-history.test.tsx` (orden, tipo con texto + ícono, responsable, fecha en Bogotá, «Automático», filtros, paginación); E2E: el movimiento recién registrado aparece primero. |
| CA-09 | `use-products` con reloj falso (sondeo de 30 s solo visible, reconsulta al volver) y `freshness` («Actualizado hace N s»). |
| CA-10 | Pruebas de componente con roles y nombres («Marcar agotado Capuchino», «Registrar movimiento de Capuchino»), foco al abrir y cerrar el formulario; E2E en 360 px: sin desborde y botones ≥ 48 px. |
| CA-11 | `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `npm audit`, E2E completo. |
| CA-12 | El conjunto anterior (unitarias, de componente y E2E del mock). |

## 5. Orden de implementación (cada paso termina en verde: `tsc`, `eslint`, `prettier`, pruebas)

1. Mock: catálogo, `GET /products`, `PATCH sold-out`, `POST/GET /movements`, `GET /menu` derivado, con `inventory.test.ts`; las pruebas existentes del mock siguen verdes.
2. Lógica pura (`availability`, `movement`, `errors`) con pruebas.
3. Datos (hooks de productos, agotado, movimientos) con pruebas; `useNow` con intervalo.
4. «Productos»: filtros, fila, estado, vista; pruebas de componente.
5. «Inventario»: saldos, formulario, historial; pruebas de componente.
6. Rutas y navegación; pruebas de navegación y panel de bienvenida.
7. E2E `inventory.spec.ts` (escritorio y 360 px) y revisión visual con capturas.
8. Verificación completa, `tasks.md` y `docs/commits/004b.md`; parar para tu revisión.

## 6. Riesgos técnicos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| E2E en paralelo (escritorio y 360 px) comparten el mock y el catálogo | Cada proyecto usa **su propio producto** para agotar y mover saldo (p. ej. Espresso en escritorio, Latte en móvil); ninguna otra prueba usa esos productos (los pedidos usan Capuchino); al terminar cada prueba deja su producto como estaba. |
| Agotar el producto equivocado rompe pruebas de pedidos | Las pruebas de pedidos usan Capuchino; las de inventario, otros SKU, y el mock expone un reinicio del catálogo. |
| Movimiento duplicado por error de red ambiguo | Sin reintento automático, aviso explícito y botón «Ver historial» (D-068); la prueba simula el corte con `page.route` y comprueba que no hay segundo `POST`. |
| El back real acepta un movimiento sobre un combo | El front ya no lo ofrece; P-06 lo verifica y, si lo acepta, se pide al back rechazarlo. |
| `GET /products` devuelve más de 100 productos | Aviso «Mostrando los 100 primeros de T» y la búsqueda del back (`search`) queda disponible para una mejora; hoy el menú real tiene ~25. |
| Dos operadores agotan/ vuelven a vender a la vez | Idempotente: gana el último; el sondeo de 30 s lo refleja; sin conflicto que explicar. |
| El saldo mostrado se desactualiza entre sondeos | El formulario muestra el saldo conocido, pero el 409 del back (con su mensaje) es la autoridad; al fallar se reconsulta el catálogo. |
| Nombre del responsable o motivos con texto raro | Todo se pinta como texto (sin HTML); motivo máximo 300; un motivo con caracteres de control se rechaza en el formulario. |

## 7. Fuera de plan

Crear, editar, activar/desactivar y eliminar productos y combos (007); umbral de «poco saldo» (necesita el back); detalle de pedido para el personal con enlace desde el historial (007); costos y márgenes; exportar historial; deshacer movimientos.
