# Spec 003 — Pedido y pago

**Repo:** `mocca-go-front` · **Fecha:** 2026-11-10 · **Estado:** aprobada el 2026-11-10 · v1.1 (DP-01 a DP-14 pasan a D-039 a D-046)
**Contrato consumido:** `docs/openapi.json` (back, incrementos 001–019) · **Siguiente paso tras aprobar:** `plan.md` → `tasks.md`

---

## 1. Objetivo

Que un **cliente con sesión pueda convertir su carrito en un pedido**: elegir dónde recibirlo (zona, punto y piso), pagar con la tarjeta de demostración, ver la confirmación y **consultar sus pedidos** (lista y detalle con línea de tiempo), incluida la opción de **cancelar** mientras siga en «recibido». El botón «Continuar» del carrito, hoy deshabilitado, empieza a funcionar.

El **seguimiento en vivo** (canal SSE, sin recargar, con repartidor y hora estimada) queda para el incremento **003b**, que se hace justo después. En este incremento el detalle de un pedido se mantiene al día consultando al back (cada 15 s mientras el pedido no haya terminado y al volver a la pestaña).

## 2. Decisiones ya tomadas

| ID | Decisión | Origen |
|---|---|---|
| D-014 / D-016 | El navegador solo habla con `/api/...`; la pasarela agrega el `Bearer` y solo deja pasar las rutas del contrato. `GET /delivery-zones` es pública. | Spec 001 |
| D-017 | Los `POST` exigen mismo origen y `Content-Type: application/json` (o sin cuerpo). | Spec 001 |
| D-029 / D-030 / D-033 | El carrito vive en `localStorage`, se reconcilia con el menú y se vacía al cerrar sesión. | Spec 002 |
| D-034 | «Continuar»: visitante → «Ingresar para pedir»; cliente → deshabilitado hasta este incremento. | Spec 002 |
| D-035 | Pesos `$4.500`; zona horaria America/Bogota. | Spec 002 |
| D-037* | El seguimiento en vivo (SSE) se separa en el incremento **003b**. | Usuario, 2026-11-10 |
| D-038* | Pago de demostración con campo de tarjeta + ayuda «Usar tarjeta de prueba» (sin fecha ni CVV: el back no los pide). | Usuario, 2026-11-10 |

\* Registradas en `docs/decisions.md` (D-037 a D-046).

## 3. Alcance

**Entra**
- Página de pedido `/cliente/pedido`: resumen del carrito, punto de entrega (zona → punto → piso si aplica), indicación de entrega, nota para la cocina, pago con tarjeta de demostración y «Pagar».
- Crear el pedido (`POST /orders`) con `Idempotency-Key`, manejo de cada error del contrato (400, 402, 404, 409, 429) y confirmación.
- «Mis pedidos» `/cliente/pedidos`: lista paginada, más reciente primero.
- Detalle `/cliente/pedidos/[id]`: productos (con los componentes de combos), total, entrega, pago (últimos 4 y estado), línea de tiempo de estados, motivo de cancelación o de no entrega, repartidor y hora estimada si el back los trae.
- Cancelar un pedido propio en «recibido» (con confirmación en línea).
- «Continuar» del carrito activo para el cliente; «Mis pedidos» habilitado en la navegación.
- Mock de la API ampliado: zonas y puntos, crear/listar/consultar/cancelar pedido, tarjeta rechazada, conflictos, y un endpoint de control para avanzar el estado de un pedido en los E2E.

**No entra**
- Canal SSE y actualización instantánea (003b).
- Encuesta de satisfacción y perfil del cliente (006).
- Cocina (004), despacho (005), vistas del personal.
- Pasarela de pago real, guardar tarjetas, fecha de vencimiento o CVV.
- Reintento o reembolso de pedidos «no entregado» (el back lo deja sin decidir; solo se muestra el estado y el motivo).
- Editar un pedido ya creado.

## 4. Contrato consumido

| Operación | Respuesta relevante | Errores a manejar |
|---|---|---|
| `GET /delivery-zones` (pública) | `{ data: [{ id, name, points: [{ id, name, hint, floors }] }] }`; solo zonas y puntos activos. `floors` es `null` si el punto no tiene pisos. | 429, 502/504. |
| `POST /orders` (cliente) | Cabecera `Idempotency-Key` (UUID). Cuerpo `{ items:[{productId, quantity 1–10}] (1–10 líneas), pointId, floor? (1–30; obligatorio si el punto tiene pisos, prohibido si no), deliveryNote? (1–200), note? (1–200), payment:{ method:'tarjeta_demo', cardNumber: 16 dígitos } }`. Responde `OrderResponse` (**201** si lo creó; **200** si la misma clave ya existía y devuelve el mismo pedido). El back calcula el total con los precios vigentes. | 400 (mensajes en arreglo), **402** (tarjeta rechazada: `4000000000000002`), 404 (producto o punto inexistente), **409** (producto agotado o sin saldo), 429 (10 por minuto por IP), 401/403. |
| `GET /orders?page=&limit=&status=` (cliente: los suyos) | `{ page, limit, total, totalPages, data: OrderResponse[] }`, más reciente primero. | 401, 429. |
| `GET /orders/:id` | `OrderResponse` (404 si no existe **o no es tuyo**). | 400 (id inválido), 404. |
| `POST /orders/:id/cancel` (sin cuerpo para el cliente) | `OrderResponse` con estado `cancelado` y pago `reembolsado`. | 409 (el pedido ya no está en «recibido»), 404. |

**`OrderResponse` relevante:** `id`, `number` (consecutivo legible, p. ej. 1001), `status` (`recibido`, `en_preparacion`, `listo`, `en_camino`, `entregado`, `no_entregado`, `cancelado`), `total`, `items[{productId, sku, name, quantity, unitPrice, lineTotal, components}]`, `delivery{pointName, zoneName, floor, deliveryNote, etaAt, courier{fullName, phone, whatsappUrl}}`, `note`, `payment{method, last4, status: aprobado|reembolsado}`, `cancelReason`, `failureReason`, `events[{status, at}]`, `createdAt`.

**Hallazgos al cruzar el contrato**
- La tarjeta **no se guarda** en el back (solo `last4`); el front tampoco debe guardarla en ningún lado (ni `localStorage`, ni caché de consultas, ni registros).
- El back vuelve a calcular el total: el total del carrito sigue siendo **informativo**; la confirmación muestra el total real del pedido.
- Un **200** (en vez de 201) significa «esta clave ya se usó»: es un éxito (el mismo pedido), no un error.
- 404 en un pedido ajeno es indistinguible de uno inexistente: el front muestra «No encontramos este pedido».
- `etaAt` y `courier` solo vienen en «en_camino».

## 5. Decisiones de diseño propuestas (requieren tu visto bueno)

| ID | Propuesta | Alternativa |
|---|---|---|
| DP-01 | **El pedido es una página** (`/cliente/pedido`), no un panel: es un formulario largo con pago. «Continuar» en el carrito cierra el panel y navega allí. Dentro del marco del cliente (menú lateral, «Salir»). | Panel dentro del menú (queda apretado en móvil). |
| DP-02 | **Punto de entrega en dos selectores:** zona y luego punto (lista nativa `<select>`, accesible y cómoda en móvil); se muestra la pista (`hint`) del punto elegido. Si el punto tiene pisos, aparece un selector de piso (1 a `floors`); si no, no se envía. | Lista única de puntos agrupada por zona. |
| DP-03 | **Un solo botón «Pagar $X»** al final, con el resumen siempre visible (en móvil, resumen colapsable arriba). El botón se deshabilita mientras se envía (sin doble clic). | Pasos separados (entrega → pago → confirmar). |
| DP-04 | **Idempotencia:** se genera un UUID por intento y se guarda en `sessionStorage` junto con una huella del contenido (productos, punto, piso, notas, últimos 4 dígitos). Si la petición falla por red/timeout y el cliente reintenta con **los mismos datos**, se reenvía la **misma clave** (el back devuelve el mismo pedido y no cobra dos veces); si cambió algo, se crea una clave nueva. Se borra al tener éxito. | Clave nueva en cada clic (riesgo de cobro doble tras un timeout). |
| DP-05 | **Tarjeta:** campo de 16 dígitos con espacios cada 4 (se envía sin espacios), `inputMode="numeric"`, `autocomplete="cc-number"`; nota «Tarjeta de prueba: 4242 4242 4242 4242 aprueba» y botón «Usar tarjeta de prueba». Se valida (16 dígitos) antes de enviar. El número vive solo en el estado del formulario y se descarta al terminar. | — |
| DP-06 | **Errores sin perder lo escrito:** 402 → «La tarjeta fue rechazada» junto al campo de tarjeta (el resto se conserva); 409/404 → se vuelve a pedir el menú, se reconcilia el carrito (D-033) y se explica qué cambió; 400 → mensajes del back; 429 → «Demasiados intentos, espera un momento»; 5xx/red → aviso con «Reintentar» (misma clave, DP-04). | — |
| DP-07 | **Éxito:** se vacía el carrito **solo después** de un 200/201, se limpia el borrador y se navega a `/cliente/pedidos/[id]?nuevo=1`, que muestra «¡Pedido #1001 recibido!» (anunciado a lectores de pantalla). | Pantalla de confirmación aparte. |
| DP-08 | **Borrador del pedido:** punto, piso y notas se recuerdan en `sessionStorage` mientras dure la pestaña (nunca la tarjeta); se descartan si el punto ya no existe en las zonas activas. | No recordar nada. |
| DP-09 | **Mis pedidos:** lista de 10 por página con «Ver más» (acumula páginas); cada fila muestra número, fecha y hora (es-CO, Bogotá), estado con etiqueta y color de token, total y cantidad de productos; vacío: «Aún no has hecho pedidos» con enlace al menú. | Paginación numerada. |
| DP-10 | **Detalle con línea de tiempo** de `events` (estado + hora), el estado actual resaltado. Se consulta cada **15 s** mientras el estado no sea final (`entregado`, `cancelado`, `no_entregado`) y al volver a la pestaña; sin consulta periódica en pedidos terminados. (003b lo reemplaza por SSE.) | Solo al recargar. |
| DP-11 | **Cancelar** solo si `status === 'recibido'`: botón «Cancelar pedido» con confirmación en línea (igual que «Vaciar carrito»); si el back responde 409, se explica que ya entró a preparación y se refresca el pedido. Tras cancelar se muestra «Reembolsado». | Ocultar el botón siempre. |
| DP-12 | **Repartidor en «en_camino»:** nombre, teléfono y enlace de WhatsApp (solo si la URL empieza por `https://wa.me/`) y la hora estimada de llegada, cuando el back los trae. | No mostrarlos hasta 003b. |
| DP-13 | **Guardas:** `/cliente/pedido*` y `/cliente/pedidos*` caen bajo el layout del cliente (otros roles → su panel; sin sesión → `/login`). Con el carrito vacío, `/cliente/pedido` redirige al menú con un aviso. | — |
| DP-14 | **Etiquetas de estado:** Recibido, En preparación, Listo, En camino, Entregado, No entregado, Cancelado; con ícono y texto (no solo color). | — |

## 6. Rutas y comportamiento

| Ruta | Quién | Qué muestra |
|---|---|---|
| `/cliente/pedido` | Cliente | Formulario: resumen, entrega, notas, pago, «Pagar». |
| `/cliente/pedidos` | Cliente | Mis pedidos (lista paginada). |
| `/cliente/pedidos/[id]` | Cliente | Detalle y línea de tiempo; cancelar si corresponde. |

**Reglas del formulario**
- Obligatorios: punto de entrega, piso (si el punto tiene pisos) y tarjeta de 16 dígitos. Opcionales: indicación de entrega y nota, hasta 200 caracteres cada una, con contador.
- Se bloquea «Pagar» si el carrito tiene productos agotados o retirados (se avisa con enlace al menú) o más de 10 líneas.
- Las notas no se envían si están vacías (el back exige al menos 1 carácter).
- Mientras se envía: botón con «Procesando…», campos deshabilitados, aviso anunciado a lectores.
- El total mostrado antes de pagar se rotula «Total estimado»; la confirmación y el detalle muestran el total real del back.

**Fechas:** `Intl.DateTimeFormat('es-CO', { timeZone: 'America/Bogota' })`, p. ej. «10 nov, 12:31 p. m.».

**Seguridad:** el número de tarjeta no se escribe en `localStorage`/`sessionStorage`, no entra a la caché de TanStack Query ni a ningún registro; no aparece en la URL; la pasarela no registra cuerpos; la respuesta solo trae `last4`. El enlace de WhatsApp se valida antes de renderizar.

**Diseño:** tokens de color de D-027, objetivos táctiles de 44 px, sin desborde horizontal desde 360 px, estados con texto + ícono.

## 7. Criterios de aceptación

| ID | Criterio (verificable) |
|---|---|
| CA-01 | «Continuar» del carrito, para un cliente, abre `/cliente/pedido` (cierra el panel); con el carrito vacío, `/cliente/pedido` redirige al menú con aviso; visitante y personal no llegan (guardas). |
| CA-02 | Las zonas y puntos salen de `GET /delivery-zones`; al elegir un punto con pisos aparece el selector de piso (1 a `floors`) y es obligatorio; un punto sin pisos no envía `floor`; se muestra la pista del punto. |
| CA-03 | La tarjeta acepta solo dígitos, se formatea en grupos de 4, se valida (16 dígitos), «Usar tarjeta de prueba» pone `4242 4242 4242 4242`; se envía sin espacios. |
| CA-04 | El pedido se envía con `Idempotency-Key` (UUID v4), los productos y cantidades del carrito, `pointId`, `floor`/notas solo si aplican y `payment{method:'tarjeta_demo', cardNumber}`. |
| CA-05 | Éxito (201): el carrito queda vacío, se navega al detalle con «¡Pedido #N recibido!» y el total real; con 200 (clave repetida) se comporta igual sin duplicar. |
| CA-06 | 402: aviso «La tarjeta fue rechazada» junto al campo de tarjeta, el carrito y el resto del formulario se conservan; se puede corregir y reintentar. |
| CA-07 | 409 y 404 (producto agotado/retirado o punto inexistente): se refresca el menú y las zonas, se reconcilia el carrito, se explica qué cambió y el carrito no se pierde. |
| CA-08 | 400 muestra los mensajes del back; 429 muestra «Demasiados intentos…»; 5xx/red muestran «Reintentar», que reenvía **la misma** `Idempotency-Key` si los datos no cambiaron y una nueva si cambiaron. |
| CA-09 | Sin doble cobro: doble clic o doble Enter envía una sola petición; el botón queda deshabilitado mientras dura. |
| CA-10 | El número de tarjeta no aparece en `localStorage`, `sessionStorage`, URL ni caché de consultas (prueba que lo verifica después de pagar y después de un error). |
| CA-11 | Borrador: punto, piso y notas sobreviven a recargar la pestaña (nunca la tarjeta) y se descartan si el punto ya no existe. |
| CA-12 | «Mis pedidos» lista los del cliente, más reciente primero, con número, fecha (Bogotá), estado (texto + ícono), total y cantidad de productos; «Ver más» agrega la página siguiente; vacío con enlace al menú; error con «Reintentar». |
| CA-13 | El detalle muestra productos (con componentes de combos), total, punto/zona/piso, indicación, nota, pago (últimos 4 y estado), y la línea de tiempo con `events`; un id ajeno o inexistente muestra «No encontramos este pedido». |
| CA-14 | Mientras el pedido no es final, el detalle se vuelve a consultar cada 15 s y al volver a la pestaña; en un estado final no hay consultas periódicas. Un cambio de estado (E2E con el endpoint de control) se refleja sin recargar. |
| CA-15 | Cancelar: solo en «recibido»; pide confirmación en línea; al terminar el estado pasa a «Cancelado» y el pago a «Reembolsado»; 409 explica que ya no se puede y refresca. |
| CA-16 | En «en_camino» se muestran repartidor, teléfono, hora estimada y WhatsApp (solo `https://wa.me/…`); en «no_entregado» y «cancelado» se muestra el motivo. |
| CA-17 | «Mis pedidos» está habilitado en la navegación del cliente; el carrito se vacía solo tras un pago exitoso (no antes ni en errores). |
| CA-18 | Accesibilidad: etiquetas asociadas, errores junto al campo y anunciados, foco al primer error, confirmación anunciada, estados con texto, contraste AA, 44 px, sin desborde en 360 px. |
| CA-19 | Solo tokens de color; `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `audit` y `e2e` en verde. |
| CA-20 | Pruebas: unitarias (formato y validación de tarjeta, huella/idempotencia, cuerpo del pedido, mapeo de errores, formato de fechas, estados), de componente (formulario de pedido, lista, detalle, cancelar) y E2E contra el mock (pagar, rechazo 402, conflicto 409, ver pedido, cancelar, avance de estado, guardas). |

## 8. Verificación contra el back real

Con el back local y el seed:
1. Entrar como cliente, agregar un capuchino y «Continuar»; elegir zona/punto (y piso si aplica) y pagar con `4242 4242 4242 4242`: llega el detalle con «¡Pedido #… recibido!» y el carrito queda vacío.
2. Repetir con `4000 0000 0000 0002`: sale «La tarjeta fue rechazada» y el carrito se conserva.
3. En «Mis pedidos» aparece el pedido; cancelarlo en «recibido»: queda «Cancelado» y «Reembolsado», y el saldo del producto vuelve (consulta en `GET /menu`).
4. Con el operador (Postman) `POST /kitchen/orders/:id/start` sobre un pedido nuevo: el detalle, abierto en el navegador, pasa a «En preparación» en ≤ 15 s; «Cancelar» ya no aparece.
5. Marcar un producto como agotado y tratar de pagar un carrito que lo tenga: aviso de conflicto sin perder el carrito.

## 9. Riesgos y pendientes

- **Límite de 10 pedidos por minuto por IP** (`POST /orders`): detrás de Railway la IP debe ser la real (`TRUST_PROXY_HOPS`, P-01); si no, varios clientes del campus compartirían el cupo.
- **Cobro doble por timeout:** lo cubre la clave de idempotencia (DP-04); hay que confirmar en la prueba manual que reenviar la misma clave devuelve el mismo pedido.
- **Consulta cada 15 s** es provisional: 003b la reemplaza con SSE (y P-02: límite de duración de peticiones del proxy de Railway para el SSE).
- **Pedidos `no_entregado`:** el back no define reembolso ni reintento; solo se muestra el estado y el motivo.
- **Sin encuesta ni perfil todavía:** un pedido «entregado» no pide calificación hasta el incremento 006.

## 10. Siguiente paso

Apruebas (o ajustas) esta spec y las propuestas DP-01 a DP-14 → `plan.md` → apruebas → `tasks.md` → código y pruebas; me detengo para tu revisión.
