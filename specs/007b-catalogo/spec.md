# Spec 007b — Admin: catálogo y combos

**Repo:** `mocca-go-front` · **Fecha:** 2026-11-11 · **Estado:** v2, aprobada el 2026-11-11 (DP-01 a DP-12; DP-07 y DP-08 con confirmación) · decisiones en `docs/decisions.md` D-114 en adelante
**Contrato consumido:** `docs/openapi.json` (módulo `products`, sin rutas nuevas) y `docs/frontend-handoff.md` §3, §5 · **Siguiente paso tras aprobar:** `plan.md` → `tasks.md`

---

## 1. Objetivo

Que el **administrador** gestione el catálogo desde la app: ver todos los productos (activos e inactivos), **crear** productos simples y **combos**, **editar** sus datos y precios, **armar y cambiar la composición de un combo**, **activar o desactivar** y **eliminar** los que no tengan historial. Hoy el catálogo solo se carga con el seed; con esto el admin deja de depender de Postman.

## 2. Decisiones ya tomadas

| ID | Decisión | Origen |
|---|---|---|
| D-012 | Cada rol solo visita su prefijo; el admin solo `/admin`. | Spec 001 |
| D-014 / D-016 | El navegador solo habla con `/api/...`; las 8 operaciones de `products` ya están en la tabla de rutas. | Spec 001 |
| D-046 | Estados con texto + ícono, nunca solo color. | Spec 003 |
| D-058 | 409/404 de una acción se explican en un aviso («Entendido») y se refresca el estado. | Spec 004 |
| D-066 | Estado de disponibilidad en palabras con ícono (Disponible, Agotado, Sin saldo, Inactivo, Falta saldo de un componente). | Spec 004b |
| D-070 | **Hoy:** sin costos ni márgenes en pantalla aunque el back los devuelva (decidido para el personal). Ver DP-03. | Spec 004b |
| D-071 | Un combo no tiene movimientos: su saldo es calculado y su precio es el de la suma al crearlo o el fijado a mano. | Spec 004b |
| D-111 | Crear, editar y eliminar no se reintentan solos; tras un corte de red se consulta y se confirma. | Spec 007a |

## 3. Alcance

**Entra**
- Pantalla **«Catálogo»** (`/admin/catalogo`), habilitada en la navegación del admin (hoy «Próximamente»).
- Lista **paginada por el servidor** (20 por página) con búsqueda (SKU o nombre), filtro por categoría y por estado.
- **Crear** producto simple y **combo**; **editar** nombre, descripción, categoría, precio y costo; **componer/recomponer** un combo; **activar/desactivar**; **eliminar**.
- Mock ampliado (escritura de productos con las reglas y textos del back) y pruebas (unitarias, de componente y E2E).

**No entra**
- Imágenes de productos (el back no las tiene).
- **Movimientos e inventario** (ya existen en «Inventario»), ni el interruptor «agotado» de cocina (ya existe en «Productos» del operador) salvo lo que decidas en DP-07.
- Cambiar el SKU (es inmutable), convertir un producto en combo o a la inversa (el back lo rechaza) ni editar el costo de un combo (se calcula).
- Zonas y puntos (007c), pedidos (007d).

## 4. Contrato consumido

| Operación | Cuerpo / respuesta relevante | Errores a manejar |
|---|---|---|
| `GET /products?page&limit&search&active&category` | Admin u operador. `{ data: Product[], page, limit, total, totalPages }`, orden por SKU, `limit` 1–100. `search`: texto parcial en SKU o nombre sin distinguir mayúsculas. `active=true|false`; sin él trae activos e inactivos. `category`: `combo`, `cafe`, `bebida`, `panaderia`, `pasteleria`, `snack`. | 401, 403, 400 |
| `POST /products` | **Simple:** `{ sku, name, description?, category, price, cost }` (`price` y `cost` obligatorios). **Combo:** `{ sku, name, description?, category:'combo', components, price? }` (`components` 2–10 productos distintos con cantidad 1–10; `cost` **no** se envía, se calcula; si no hay `price`, vale la suma de los componentes al crearlo). `sku`: `^[A-Z0-9][A-Z0-9._-]{0,47}$`, único e inmutable; `name` 1–120; `description` 1–500; `price` 1–1.000.000 entero; `cost` 0–1.000.000 entero. Nace activo, sin «agotado» y con stock 0. 201 → `Product`. | 400 por campo · 409 `El SKU ya existe.` |
| `PATCH /products/{id}` | `{ name?, description? (null la borra), category?, price?, cost? }`, al menos uno. No cambia SKU, estado, agotado, stock ni componentes. `cost` no se admite en combos; la categoría no pasa hacia ni desde `combo`. | 400 `Indica al menos un campo para editar.` · 400 `El costo de un combo se calcula; no lo envíes.` · 400 `Un producto no se convierte en combo ni a la inversa.` · 404 `Producto no encontrado.` |
| `PATCH /products/{id}/status` | `{ active }`. Desactivar conserva saldo e historial. | 404 |
| `PUT /products/{id}/components` | `{ components: [{ productId, quantity }] }`: reemplaza toda la composición (2–10 simples, activos y distintos; cantidad 1–10). Si es inválida, se conserva la anterior. **No recalcula el precio.** | 400 `Un combo lleva entre 2 y 10 componentes.` · 400 `No repitas productos en la composición.` · 400 `Algún componente no existe.` · 400 `El componente {SKU} es un combo; un combo no contiene combos.` · 400 `El componente {SKU} está inactivo.` · 409 `El producto no es un combo.` · 404 |
| `DELETE /products/{id}` | 204. Solo si no tiene movimientos y no es componente de un combo. | 409 `El producto tiene movimientos; desactívalo con PATCH /products/:id/status.` · 409 `El producto es componente de un combo.` · 404 |

`Product`: `{ id, sku, name, description|null, category, price, cost, costPercent|null, soldOut, available, active, stock, components: [{ productId, sku, name, quantity }], createdAt, updatedAt }`. En un combo, `cost` y `stock` son calculados y `components` trae la composición; en un simple, `components` es `[]`.

**Hallazgos al cruzar el handoff con el OpenAPI y el código del back**
1. **Sin cambios en el back:** todo lo necesario ya existe.
2. **El precio de un combo no se recalcula** al cambiar sus componentes (ni al cambiar el precio de un componente): queda el que se fijó al crearlo o editarlo. El costo sí se recalcula, así que el margen puede cambiar sin avisar. Conviene mostrarlo (DP-03) y avisarlo al recomponer.
3. **Un combo solo contiene productos simples y activos.** Desactivar un producto que es componente de un combo no se lo impide el back, pero ese combo deja de estar disponible (queda «Falta saldo de un componente»/no vendible); el front lo advierte.
4. **El listado no permite excluir combos**: el selector de componentes pide los productos activos y descarta los combos en el front.
5. **Eliminar** exige que el producto no tenga movimientos ni sea componente; casi todo producto «real» tendrá movimientos y se desactiva en vez de borrarse (el back lo dice en el 409).
6. **El costo es obligatorio al crear un producto simple**: para crearlo el admin debe escribirlo (relacionado con D-070, ver DP-03).
7. **Categoría `combo` solo para combos:** al crear se elige «Combo» o una categoría simple; al editar, la categoría se limita a las simples (en un simple) o no se cambia (en un combo).

## 5. Decisiones de diseño propuestas (requieren tu visto bueno)

| ID | Propuesta | Alternativa |
|---|---|---|
| DP-01 | **Una sola pantalla** `/admin/catalogo`: lista de filas (tarjeta en celular, columnas desde `md`) con SKU, nombre, categoría, precio, estado en palabras con ícono (D-066) y acciones; contenido centrado (ancho máximo 64 rem). Combos con una etiqueta «Combo» y sus componentes resumidos. | Tabla HTML; pantallas separadas para simples y combos. |
| DP-02 | **Lista paginada en el servidor** (20 por página con `Pagination`): búsqueda por SKU o nombre (con espera de 400 ms), filtro de categoría (Todas + las 6) y de estado (Todos, Activos, Inactivos); al cambiar un filtro vuelve a la página 1. Por defecto: todos. | Cargar todo el catálogo (hasta 100) y filtrar en el front. |
| DP-03 | **Costo y margen visibles solo en el catálogo del admin** (excepción a D-070, que sigue vigente para el personal): se muestran `cost` y `costPercent` («Costo 35,6 % del precio») en el panel y la fila, porque son necesarios para crear y editar productos y para vigilar el margen de los combos. | Mantener D-070 también aquí (el costo se escribe al crear/editar pero no se muestra el margen). |
| DP-04 | **Crear** en un panel lateral con un selector «Tipo»: **Producto** (SKU, nombre, descripción, categoría simple, precio, costo) o **Combo** (SKU, nombre, descripción, componentes y precio opcional). El SKU se escribe en mayúsculas (el campo las convierte) y se valida con el patrón del back. Precios y costo son enteros COP con ayuda («$4.500»). | Dos botones «Crear producto» y «Crear combo». |
| DP-05 | **Armar un combo:** selector de componentes con búsqueda sobre productos **simples y activos** (los combos y los inactivos no se ofrecen), cantidad 1–10 por componente, entre 2 y 10 componentes sin repetir. Muestra en vivo la **suma de precios** y el **costo calculado**; el precio del combo es opcional y por defecto se sugiere la suma (puedes dejarlo vacío y el back usa la suma). | Lista simple de checkboxes sin cálculo. |
| DP-06 | **Editar** en el mismo panel: nombre, descripción (vacía = la borra), categoría (solo entre simples), precio y costo (no en combos); SKU solo lectura. Un combo tiene además «Composición» (`PUT` completo) con el aviso **«El precio del combo no cambia al cambiar sus componentes: revísalo»** y la comparación precio vs. suma actual. Solo se envía lo modificado. | Edición por campo. |
| DP-07 | **Estado y «agotado»:** botón «Desactivar»/«Activar» en la fila **con confirmación en línea** (decidido por ti; el texto de desactivar avisa si afecta a un combo) y aviso al terminar; al desactivar un producto que es componente de un combo, la confirmación dice que ese combo dejará de estar disponible. El interruptor «agotado» **también** aparece en la fila para el admin (reutiliza el del operador). | Solo activar/desactivar; «agotado» solo para el operador. |
| DP-08 | **Eliminar** con confirmación en línea («¿Eliminar {nombre}? No se puede deshacer»). Los dos 409 se explican con el texto del back y se ofrece «Desactivar» como alternativa. | Sin confirmación. |
| DP-09 | **Sin reintento automático** al crear, editar, componer, activar y eliminar (D-070/D-111): tras un corte de red se consulta el producto por su SKU y se confirma (crear: si existe se da por creado; eliminar: si ya no está, por eliminado); marca síncrona contra el doble clic. | Reintento automático (descartado). |
| DP-10 | **Errores:** 409 de SKU repetido bajo el campo SKU; 400 por campo según el texto del back (nombre, descripción, precio, costo, componentes); 404 y 409 de eliminar en un aviso «Entendido» con la lista refrescada. Se muestra siempre el texto del back. | — |
| DP-11 | **Menú del cliente al día:** tras cualquier cambio se invalidan `['products']` y el menú (`['menu']`) para que lo editado se vea sin recargar. | — |
| DP-12 | **Diseño:** móvil primero (360 px), botones y filas ≥ 48 px, sin desborde, solo tokens de color, contraste AA; precios con formato COP (`$4.500`). | — |

## 6. Rutas y comportamiento

| Ruta | Quién | Qué muestra |
|---|---|---|
| `/admin/catalogo` | Admin | Lista, filtros, paneles de crear/editar y la composición de combos. |

**Reglas**
- Los parámetros de la lista (`search`, `category`, `active`, `page`) viven en el estado de la pantalla; la consulta se invalida tras cada acción.
- Un combo nunca ofrece «Costo» ni «Registrar movimiento» (se calcula).
- El precio se escribe como entero COP; el front rechaza decimales, 0 y valores > 1.000.000 antes de enviar (el mensaje del back sigue siendo la autoridad).
- **Seguridad:** solo admin; el back impone el permiso; todo texto se muestra como texto.

## 7. Criterios de aceptación

| ID | Criterio (verificable) |
|---|---|
| CA-01 | `/admin/catalogo` solo lo ve el admin (visitante → login; otros roles → su panel); «Catálogo» queda habilitado en la navegación del admin. |
| CA-02 | La lista sale de `GET /products?page&limit=20&search&category&active` y se pagina con `Pagination`: SKU, nombre, categoría, precio, estado (texto + ícono) y acciones; esqueleto al cargar; error con «Reintentar»; vacía con un mensaje. |
| CA-03 | La búsqueda (con espera), la categoría y el estado se envían al servidor, vuelven a la página 1 y anuncian «N resultados». |
| CA-04 | Crear producto simple: valida SKU (patrón del back), nombre (1–120), descripción (1–500, opcional), categoría simple, precio (1–1.000.000) y costo (0–1.000.000); un solo `POST /products` con el cuerpo exacto; 409 de SKU repetido bajo el campo. |
| CA-05 | Crear combo: componentes 2–10 distintos con cantidad 1–10 (solo simples y activos), suma y costo calculados en vivo, precio opcional; el cuerpo no lleva `cost`; el combo creado aparece en la lista con su composición. |
| CA-06 | Editar envía **solo lo modificado** (`PATCH`), deshabilitado sin cambios; SKU solo lectura; un combo no ofrece costo ni cambio de categoría; descripción vacía envía `null`. |
| CA-07 | Recomponer un combo envía `PUT /products/{id}/components`; advierte que el precio no cambia; si el back rechaza (componente inactivo, combo, repetido) se muestra el texto del back y se conserva la composición anterior. |
| CA-08 | Activar/desactivar pide confirmación en línea antes de enviar (cancelar no envía nada); «agotado» envía su petición directo; se reflejan en la fila y avisan; desactivar un componente avisa en la confirmación del combo afectado. |
| CA-09 | Eliminar: confirmación en línea; `DELETE`; los 409 (movimientos, componente de un combo) y el 404 se explican con el texto del back y se ofrece «Desactivar». |
| CA-10 | Crear, editar, componer, activar y eliminar: sin doble clic y sin reintento automático; tras un corte de red se consulta antes de ofrecer «Reintentar». |
| CA-11 | Con el mock, un producto creado o editado por el admin se ve en el menú del cliente (disponible o no según su saldo) y en «Productos»/«Inventario» del operador. |
| CA-12 | Accesibilidad: etiquetas visibles y asociadas, errores con `aria-describedby`, `aria-live` en avisos y resultados, foco al panel al abrirlo y de vuelta a la fila al cerrarlo, estados con texto + ícono, contraste AA. |
| CA-13 | Diseño: 360 px sin desborde; botones y filas ≥ 48 px; escritorio centrado; solo tokens de color; precios en COP. |
| CA-14 | `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `audit` y `e2e` en verde. |
| CA-15 | Pruebas: unitarias (esquemas, suma y costo del combo, diferencias de edición, errores, parámetros de la lista), de componente (lista, crear, combo, editar, composición, estado, eliminar, errores) y E2E contra el mock (crear simple y combo, editar, recomponer, activar/desactivar, eliminar, 409 de cada tipo, corte de red, 360 px, el producto aparece en el menú). |

## 8. Mock de la API (cambios)

`GET /products` con `search`, `active`, `category`, `page`, `limit`; `POST /products` (simple y combo, con los 400/409 y textos del back); `PATCH /products/{id}`, `PATCH /products/{id}/status`, `PUT /products/{id}/components`, `DELETE /products/{id}` (409 con movimientos o componente de un combo); el menú del cliente sale del mismo almacén.

## 9. Verificación contra el back real

Con el back local y el seed:
1. Crear un producto simple (SKU nuevo): aparece en la lista y, tras hacer entrada en «Inventario», en el menú del cliente.
2. Crear un combo con 2 componentes sin precio: queda con la suma; con precio, el indicado.
3. Recomponer el combo: el precio no cambia (y el aviso lo dice); un componente inactivo da 400 explicado.
4. Editar nombre y precio; vaciar la descripción (la borra).
5. Desactivar un producto que es componente de un combo: el combo deja de estar disponible.
6. Eliminar uno recién creado (sin movimientos): desaparece; uno con movimientos o que es componente: 409 explicado.

## 10. Riesgos y pendientes

- **Precio de combos desactualizado:** el back no recalcula el precio al cambiar componentes o sus precios; el front lo avisa pero no lo corrige (quedaría para el back si lo quieres).
- **Productos con historial no se pueden borrar**, solo desactivar (por diseño del back).
- **Sin imágenes ni orden manual del menú** (el back ordena por categoría).
- **D-070:** si prefieres mantener sin márgenes también en el catálogo del admin, se simplifica DP-03/05.

## 11. Siguiente paso

DP aprobadas → `plan.md` (hecho, espera tu visto bueno) → `tasks.md` → código y pruebas; me detengo para tu revisión.
