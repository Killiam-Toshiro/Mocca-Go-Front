# Spec 004b — Productos agotados e inventario (operador y admin)

**Repo:** `mocca-go-front` · **Fecha:** 2026-11-10 · **Estado:** aprobada el 2026-11-10 (DP-01 a DP-10 pasan a D-065 a D-074)
**Contrato consumido:** `docs/openapi.json` (módulos `products` y `movements`) y `docs/frontend-handoff.md` §3 · **Siguiente paso tras aprobar:** `plan.md` → `tasks.md`

---

## 1. Objetivo

Que el **operador** pueda, sin pedirle nada al admin, (a) **marcar y desmarcar «agotado»** un producto cuando se acaba en la cocina y (b) **registrar entradas y salidas de inventario** y consultar el historial de movimientos. Al marcar «agotado» el producto deja de ser pedible en el menú del cliente. El admin ve la misma pantalla de inventario (el CRUD de catálogo es del incremento 007).

## 2. Decisiones ya tomadas

| ID | Decisión | Origen |
|---|---|---|
| D-012 | Cada rol solo visita su prefijo; el admin vive en `/admin/...`. | Spec 001 |
| D-014 / D-016 | El navegador solo habla con `/api/...`; la pasarela solo deja pasar rutas del contrato (ya están `GET /products`, `PATCH /products/{id}/sold-out`, `GET/POST /movements`). | Spec 001 |
| D-046 | Estados con texto + ícono, nunca solo color. | Spec 003 |
| D-055 | Operador y admin comparten pantalla (cada uno en su prefijo). | Spec 004 |
| D-058 | Los avisos de conflicto/estado desactualizado viven en la pantalla, no en una tarjeta que puede moverse. | Spec 004 |

## 3. Alcance

**Entra**
- **Productos** (`/operador/productos`): lista del catálogo con estado de disponibilidad y un interruptor «Marcar agotado» / «Volver a vender».
- **Inventario** (`/operador/inventario` y `/admin/inventario`): saldo por producto, formulario para registrar una **entrada** o **salida** (cantidad y motivo) y **historial** de movimientos paginado con filtros por producto y tipo.
- Búsqueda por nombre o SKU y filtro por categoría; mock ampliado; pruebas unitarias, de componente y E2E.

**No entra**
- Crear, editar, activar/desactivar o eliminar productos y combos (admin, incremento 007).
- Costos, márgenes y precios en pantalla (no son del operador).
- Alertas de «poco saldo» (el back no tiene umbral; ver DP-06).
- Editar o deshacer un movimiento (el back no lo ofrece; un error se corrige con un movimiento contrario).
- Movimientos sobre combos (su saldo se calcula; ver §9).

## 4. Contrato consumido

| Operación | Comportamiento |
|---|---|
| `GET /products?page&limit&search&active&category` (admin y operador) | Página `{page, limit, total, totalPages, data}` ordenada por SKU. Cada producto trae `soldOut`, `available` (calculado: activo, no agotado, con precio y con saldo), `active`, `stock`, `category`, `components`; el back también devuelve `cost`/`costPercent`, que **esta pantalla no muestra**. |
| `PATCH /products/{id}/sold-out` `{ soldOut }` | Idempotente. Responde el producto con su `available` resultante. 404 si no existe. |
| `POST /movements` `{ productId, type: IN\|OUT, quantity (entero ≥ 1), reason (1–300) }` | Actualiza saldo y guarda el movimiento en una transacción. **No es idempotente.** Responde `{ movement, stock }`. 400, 404, 409 (producto inactivo, saldo insuficiente o máximo excedido). |
| `GET /movements?page&limit&productId&type` | Más reciente primero. Cada movimiento trae `type`, `quantity`, `reason`, `orderId` (null si es manual), `user.username`, `createdAt`. |

No hay canal en vivo para productos ni movimientos: la pantalla se mantiene al día por consulta (ver DP-05).

## 5. Decisiones de diseño propuestas (requieren tu visto bueno)

| ID | Propuesta | Alternativa |
|---|---|---|
| DP-01 | **Dos pantallas, como ya está en la navegación del operador:** «Productos» (disponibilidad rápida, pensada para tocar con el pulgar) e «Inventario» (saldos, movimientos y historial). El admin recibe solo «Inventario» por ahora. | Una sola pantalla «Inventario» con ambas cosas, y quitar «Productos» de la navegación. |
| DP-02 | **Estado de disponibilidad en palabras**, derivado de los campos del back y siempre con texto + ícono: *Disponible*, *Agotado* (marcado a mano), *Sin saldo* (`stock` 0), *Inactivo* o *Falta saldo de un componente* (combo no disponible por sus componentes). La razón sale de `soldOut`, `active`, `stock` y `available`. | Mostrar solo «Disponible / No disponible». |
| DP-03 | **«Marcar agotado» sin confirmación** (es reversible e idempotente, y en cocina importa la rapidez), con un aviso breve: «Capuchino ya no se puede pedir». «Volver a vender» igual. El botón queda deshabilitado mientras va la petición. | Pedir confirmación al marcar. |
| DP-04 | **Registrar movimiento:** producto (con búsqueda), tipo (Entrada / Salida), cantidad entera y motivo obligatorio (1–300, con contador). Como **no es idempotente**: botón con marca síncrona contra doble envío, **sin reintento automático**, y si falla la red se avisa «No sabemos si se registró: revisa el historial antes de volver a intentarlo». 409 se explica en palabras («Saldo insuficiente: hay N»). Tras registrar, se actualiza el saldo con el `stock` de la respuesta. Las **salidas** muestran el saldo resultante antes de enviar. | Pedir confirmación en cada salida. |
| DP-05 | **Al día sin canal:** consulta al entrar, al volver a la pestaña y cada 30 s mientras está visible; tras una acción propia se vuelve a consultar. Indicador «Actualizado hace N s». (Los pedidos que descuentan saldo aparecen en el historial como movimientos automáticos con enlace al número de pedido.) | Esperar a que el back tenga canal de inventario. |
| DP-06 | **Sin umbral de «poco saldo»:** no existe en el back. Se ordena por SKU y se puede filtrar «Solo sin saldo / agotados». Un umbral por producto sería trabajo del back/admin. | Umbral fijo en el front (p. ej. ≤ 5), que sería inventado. |
| DP-07 | **Historial:** 20 por página, filtros por producto y tipo, cada fila con fecha (America/Bogota), tipo con texto + ícono, cantidad, motivo, responsable y, si viene de un pedido, la marca «Automático» con el identificador del pedido (sin enlace ni número: el personal aún no tiene detalle de pedido; ver plan). | Solo manuales. |
| DP-08 | **Sin costos ni márgenes** en pantalla aunque el back los devuelva; el operador no los necesita y se evita exponerlos. | Mostrarlos al admin. |
| DP-09 | **Rutas y navegación:** `/operador/productos`, `/operador/inventario`, `/admin/inventario`; «Productos» e «Inventario» pasan de «Próximamente» a habilitados en el operador; «Inventario» se agrega al admin. | — |
| DP-10 | **Diseño:** lista de tarjetas en 360 px y tabla en pantallas anchas, botones ≥ 48 px, solo tokens de color, sin desborde horizontal. | — |

## 6. Rutas y comportamiento

- `/operador/productos`: buscador, filtro de categoría y de estado (Todos · Agotados / sin saldo). Cada producto muestra nombre, SKU, categoría, estado (DP-02), saldo y el botón de agotado.
- `/operador/inventario` y `/admin/inventario`: pestañas «Saldos» (lista con acción «Registrar movimiento» por producto) y «Historial». El formulario es un panel en línea (no un modal) con foco gestionado al abrir y cerrar.
- Errores: 401 lleva a `/login`; 403 muestra «Sin permiso»; red/5xx muestran «Reintentar» sin perder lo escrito en el formulario.

## 7. Criterios de aceptación

| CA | Criterio |
|---|---|
| CA-01 | `/operador/productos` y `/operador/inventario` solo los ve el operador; `/admin/inventario` solo el admin (visitante → login; otros roles → su panel). La navegación habilita «Productos» e «Inventario» (operador) e «Inventario» (admin). |
| CA-02 | La lista sale de `GET /products` con búsqueda por nombre/SKU, filtro de categoría y paginación; no muestra costo ni margen. |
| CA-03 | Cada producto indica su estado en palabras con ícono (DP-02) y su saldo. |
| CA-04 | «Marcar agotado» / «Volver a vender» llama a `PATCH …/sold-out`, actualiza la fila con la respuesta, se anuncia por `aria-live` y un doble clic envía una sola petición. 404 explica que el producto ya no existe. |
| CA-05 | El cliente deja de poder pedir un producto marcado agotado (E2E con dos contextos: el menú del cliente lo muestra como no disponible tras la consulta). |
| CA-06 | El formulario de movimiento valida tipo, cantidad entera ≥ 1 y motivo 1–300 con mensajes en palabras; envía `POST /movements` y actualiza el saldo con el `stock` de la respuesta; un doble clic registra un solo movimiento. |
| CA-07 | 409 (saldo insuficiente, inactivo, máximo excedido) y 404 se explican sin perder lo escrito; el error de red avisa que hay que revisar el historial antes de reintentar y no reintenta solo. |
| CA-08 | El historial lista los movimientos (más reciente primero) con tipo, cantidad, motivo, responsable, fecha y, si viene de un pedido, la marca «Automático» con su identificador; filtros por producto y tipo; paginación. |
| CA-09 | Se mantiene al día: vuelve a consultar al volver a la pestaña y cada 30 s visible; indicador «Actualizado hace N s». |
| CA-10 | Accesibilidad: roles y nombres que incluyen el producto («Marcar agotado Capuchino»), foco tras cada acción, estados con texto + ícono, contraste AA, botones ≥ 48 px, sin desborde en 360 px. |
| CA-11 | Solo tokens de color; `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `audit` y `e2e` en verde. |
| CA-12 | Pruebas: unitarias (estado de disponibilidad, validación del movimiento, mapeo de errores), de componente (lista, interruptor, formulario, historial) y E2E contra el mock (agotar, movimiento, 409, historial, dos contextos, 360 px). |

## 8. Verificación contra el back real

Con el back local y el usuario `operador`:
1. `/operador/productos`: marcar «Capuchino» agotado; en otra ventana, el menú del cliente lo muestra no disponible; volver a vender.
2. `/operador/inventario`: registrar una **entrada** de 10 con motivo; el saldo sube; aparece en el historial con tu usuario.
3. Registrar una **salida** mayor al saldo: debe explicar «saldo insuficiente».
4. Hacer un pedido como cliente: aparece una salida automática con el número de pedido (confirma si el back descuenta saldo al pedir).
5. **P-06:** confirmar qué responde `POST /movements` sobre un **combo** (se espera 4xx) y si `GET /products` trae el combo con `stock` calculado.

## 9. Riesgos y pendientes

- **P-06 (combos):** el contrato no dice qué pasa al registrar un movimiento sobre un combo. Hasta confirmarlo, el front **no ofrece** «Registrar movimiento» en combos (su saldo es calculado y se muestra solo lectura).
- **Sin canal en vivo** de productos: dos operadores pueden pisarse el interruptor (es idempotente, gana el último); el sondeo de 30 s lo minimiza.
- **Movimiento no idempotente:** ante un error de red ambiguo el riesgo es duplicar; por eso no hay reintento automático (DP-04).
- **Número de pedido en el historial:** el movimiento solo trae `orderId`; mostrar «Pedido #N» exigiría consultar cada pedido. Se resuelve en el plan (consulta por lote o solo enlace).

## 10. Siguiente paso

Tu visto bueno a este spec (en especial DP-01, DP-03, DP-04 y DP-09) → `plan.md` → tu visto bueno → `tasks.md` → código y pruebas; me detengo para tu revisión.
