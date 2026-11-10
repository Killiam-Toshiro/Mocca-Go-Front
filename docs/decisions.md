# Registro de decisiones

Formato: `D-nnn` · estado (`aceptada` | `propuesta` | `reemplazada por D-nnn`) · origen. Los criterios de aceptación viven en cada spec (`CA-nn`).

## Aceptadas

| ID | Decisión | Origen |
|---|---|---|
| D-001 | Solo web responsive (sin panel de escritorio aparte). | Usuario, 2026-11-09 |
| D-002 | Tailwind + shadcn/ui. | Usuario, 2026-11-09 |
| D-005 | Next.js App Router, TypeScript estricto, npm (igual que el back), Node 24. | Handoff §10 |
| D-006 | Cliente tipado con `openapi-typescript` + `openapi-fetch`; consultas con TanStack Query. | Handoff §4 y §10 |
| D-007 | `npm run api:types` quita `/api/v1` de los paths de `docs/openapi.json` y genera `schema.d.ts` y `routes.generated.ts` (tabla de rutas del proxy de API). El cliente usa `baseUrl: "/api"`. | Usuario, 2026-11-09 |
| D-008 | Un único campo «Usuario o correo»: con `@` se envía `email`, si no `username`. | Usuario, 2026-11-09 |
| D-009 | Tras registrarse se inicia sesión automáticamente; si falla, `/login` con aviso. | Usuario, 2026-11-09 |
| D-010 | El rol se obtiene de `GET /auth/me` (lo hace el BFF), no del JWT. | Usuario, 2026-11-09 |
| D-011 | Rutas por prefijo de rol; el rol equivocado se redirige a su home. | Usuario, 2026-11-09 |
| D-012 | `admin` solo accede a `/admin` en el incremento 1; cocina/despacho de consulta se deciden en los incrementos 4 y 5. | Usuario, 2026-11-09 |
| D-013 | Puerto de desarrollo `3001`. | Usuario, 2026-11-09 |
| D-014 | Sesión en cookie `httpOnly` emitida por Next (BFF). El navegador solo habla con `/api/...` del mismo origen; Next añade el `Bearer` hacia el back. El back no cambia y el front no necesita CORS. | Usuario, 2026-11-09 |
| D-015 | Cookies `session` (`HttpOnly`, `SameSite=Lax`, `Secure` y prefijo `__Host-` en producción) y `session_exp` (legible, solo la hora de vencimiento). | Usuario, 2026-11-09 |
| D-016 | El proxy de API solo reenvía `método + ruta` de la tabla generada del OpenAPI; normaliza la ruta; host fijo; cabeceras permitidas; no reenvía la cookie; cuerpo en flujo. | Usuario, 2026-11-09 |
| D-017 | CSRF: `SameSite=Lax` + `Origin` obligatorio y coincidente en métodos no seguros + `Content-Type: application/json`. | Usuario, 2026-11-09 |
| D-018 | Guardas en dos capas: `proxy.ts` de Next (cookie presente) + layouts de servidor (`/auth/me` y rol). | Usuario, 2026-11-09 |
| D-019 | `API_URL` (solo servidor) reemplaza a `NEXT_PUBLIC_API_URL`; en Railway apunta a la red privada del servicio `api`. | Usuario, 2026-11-09 |
| D-020 | Servidor mock de la API en Node (`tests/mock-api`) para integración y E2E. | Usuario, 2026-11-09 |
| D-022 | Despliegue del front en Railway como contenedor Node persistente (`next build` + `next start`), junto al back y con `API_URL` por la red privada. Motivo: los canales SSE atraviesan el proxy y necesitan conexiones largas sin cortes por duración de función. | Usuario, 2026-11-09 |
| D-023 | **IP real hacia el back sin cambiar el back.** El front tiene su propia variable `TRUST_PROXY_HOPS` (0 en local, 1 en Railway; mismo criterio que D-56 del back). Con n > 0, el proxy de API toma la IP del cliente de `X-Forwarded-For` contando n entradas desde la derecha, la valida como IP y la envía al back **sustituyendo** cualquier `X-Forwarded-For` entrante; con 0 no envía la cabecera. | Usuario, 2026-11-09 |
| D-024 | `COOKIE_SECURE` (opcional) fuerza `Secure` y el prefijo `__Host-`; por defecto `true` si `NODE_ENV=production`. Permite correr un build de producción en `http://localhost` para las pruebas E2E. | Usuario, 2026-11-09 |
| D-025 | TypeScript fijado en **5.9.3** (no 6.x ni 7.x): `typescript-eslint` 8.72 solo admite `<6.1` y `openapi-typescript` 7.13 declara `typescript@^5.x`. Corregida el 2026-11-09 al instalar (la propuesta inicial decía 6.0.x). Se revisa al actualizar esas herramientas. | Usuario, 2026-11-09 (ajuste técnico en T-01) |
| D-026 | **Nombre visible del cliente.** `/auth/me` devuelve para un cliente su `username` interno (identificador de 17 caracteres hexadecimales generado por el back), que no debe mostrarse. El saludo y el encabezado usan `fullName` de `GET /customers/me` (consulta en el navegador con caché de 5 min, hook `useDisplayName`); mientras llega o si falla se muestra «Hola» / «Mi cuenta», nunca el identificador. El personal sigue usando su `username`. | Usuario, 2026-11-10 (hallazgo P-03) |
| D-027 | **Paleta y logo de Mocca Go.** Naranja ámbar `#fd8000` como color de marca y marrones claros (crema, café con leche, espresso, tostado) para el resto. Todo se define como tokens en `src/app/globals.css`; el texto sobre el ámbar va en espresso (blanco sobre ámbar da 2.5:1) y los enlaces usan el naranja tostado `#a94400`. Logo: taza de café dentro de un círculo naranja con «Mocca Go» al lado. Detalle, contrastes y cómo cambiarlo: `docs/design-tokens.md`. Reemplaza el tema neutro provisional. | Usuario, 2026-11-10 |
| D-028 | **Menú público.** `/` muestra el menú a todos (visitantes, clientes y personal) con una cabecera según la sesión; los clientes lo usan también desde `/cliente/menu` con el mismo componente. | Usuario, 2026-11-10 (spec 002) |
| D-029 | **Carrito en el navegador** (`localStorage`, clave `mocca-go:cart:v1`), porque el back no tiene carrito. Guarda `productId`, `quantity` y el último precio visto (solo para avisar cambios); nombre, precio y disponibilidad salen siempre del menú actual. Se valida al leer; sin `localStorage` funciona en memoria. | Usuario, 2026-11-10 (spec 002) |
| D-030 | **Un visitante puede armar su carrito**; sobrevive al inicio de sesión y se **vacía al cerrar sesión** (equipos compartidos del campus). | Usuario, 2026-11-10 (spec 002) |
| D-031 | **Carrito y detalle de producto como paneles** (`<dialog>`, sin dependencias nuevas); en móvil, barra inferior con cantidad y total. Sin páginas aparte. | Usuario, 2026-11-10 (spec 002) |
| D-032 | **El menú se pide desde el navegador** con TanStack Query (`staleTime` 30 s, refresco al volver a la pestaña) para que «Agotado» se actualice sin recargar. | Usuario, 2026-11-10 (spec 002) |
| D-033 | **Reconciliación del carrito con el menú:** producto retirado → se quita con aviso; agotado → marcado y fuera del total; precio nuevo → aviso. «Continuar» se bloquea mientras haya productos no disponibles. | Usuario, 2026-11-10 (spec 002) |
| D-034 | **Botón «Continuar»:** visitante → «Ingresar para pedir»; cliente → deshabilitado («Disponible pronto») hasta el incremento 3; el personal no ve carrito. | Usuario, 2026-11-10 (spec 002) |
| D-035 | **Formato:** pesos con `Intl.NumberFormat('es-CO', COP, sin decimales)`; categorías: Combos, Cafés, Bebidas, Panadería, Pastelería, Snacks. | Usuario, 2026-11-10 (spec 002) |
| D-036 | **Íconos por categoría** (lucide) en lugar de fotos, hasta que el back ofrezca imágenes. | Usuario, 2026-11-10 (spec 002) |

| D-037 | **El seguimiento en vivo (SSE) se separa en el incremento 003b.** El 003 cubre pedido, pago, «Mis pedidos», detalle y cancelar; el detalle se mantiene al día consultando cada 15 s mientras el pedido no sea final y al volver a la pestaña. | Usuario, 2026-11-10 (spec 003) |
| D-038 | **Pago de demostración:** campo de tarjeta de 16 dígitos con espacios cada 4, nota «4242 4242 4242 4242 aprueba» y botón «Usar tarjeta de prueba»; sin fecha ni CVV (el back no los pide). El número solo vive en el estado del formulario: nunca en almacenamiento, caché, URL ni registros. | Usuario, 2026-11-10 (spec 003) |
| D-039 | **El pedido es una página** (`/cliente/pedido`) con un solo botón «Pagar $X»; punto de entrega en dos selectores nativos (zona → punto) y piso si el punto tiene pisos. «Continuar» del carrito navega allí. | Usuario, 2026-11-10 (spec 003) |
| D-040 | **Idempotencia:** un UUID por intento en `sessionStorage` con una huella del contenido; si falla por red y se reintenta con los mismos datos se reenvía la misma `Idempotency-Key` (sin cobro doble); si cambian, clave nueva. Se borra al tener éxito. | Usuario, 2026-11-10 (spec 003) |
| D-041 | **Errores sin perder lo escrito:** 402 → «La tarjeta fue rechazada» junto al campo; 409/404 → refrescar menú y zonas, reconciliar el carrito y explicar; 400 → mensajes del back; 429 → «Demasiados intentos»; red/5xx → «Reintentar». El carrito se vacía solo tras un 200/201. | Usuario, 2026-11-10 (spec 003) |
| D-042 | **Éxito:** navegar a `/cliente/pedidos/[id]?nuevo=1` con «¡Pedido #N recibido!» anunciado; borrador (punto, piso, notas) en `sessionStorage`, nunca la tarjeta. | Usuario, 2026-11-10 (spec 003) |
| D-043 | **Mis pedidos y detalle:** lista de 10 con «Ver más»; detalle con línea de tiempo de `events`; consulta cada 15 s si el estado no es final (`entregado`, `cancelado`, `no_entregado`). Fechas es-CO, America/Bogota. | Usuario, 2026-11-10 (spec 003) |
| D-044 | **Cancelar** solo en «recibido», con confirmación en línea; 409 → explicar y refrescar; luego «Cancelado» y pago «Reembolsado». | Usuario, 2026-11-10 (spec 003) |
| D-045 | **Repartidor en «en_camino»:** nombre, teléfono, hora estimada y enlace de WhatsApp solo si empieza por `https://wa.me/`. | Usuario, 2026-11-10 (spec 003) |
| D-046 | **Estados con texto + ícono** (Recibido, En preparación, Listo, En camino, Entregado, No entregado, Cancelado); nunca solo color. | Usuario, 2026-11-10 (spec 003) |
| D-047 | **Cliente SSE propio sobre `fetch`** (sin dependencias nuevas) que lee el flujo con la cookie de sesión y conoce el código HTTP (401, 403, 429); no se usa `EventSource`. Reutilizable para cocina y despacho. | Usuario, 2026-11-10 (spec 003b) |
| D-048 | **Un canal por pestaña**, abierto por un proveedor en el layout del cliente solo con la pestaña visible; oculta **45 s** se cierra y al volver se reabre (el back permite 5 canales por usuario). | Usuario, 2026-11-10 (spec 003b) |
| D-049 | **Un evento = volver a consultar.** `ready` y `order` invalidan las consultas de pedidos; la pantalla muestra siempre datos del back, no construidos desde el evento (cuyo contenido el contrato no detalla). | Usuario, 2026-11-10 (spec 003b) |
| D-050 | **Reconexión** con espera creciente y variación (1 s a 30 s; se reinicia con `ready`); 401 → sesión vencida y sin reintento; 403 → sin reintento; 429 → espera 60 s. | Usuario, 2026-11-10 (spec 003b) |
| D-051 | **Vigilante de latido:** 60 s sin recibir nada (el back manda un latido cada 25 s) → cerrar y reconectar. | Usuario, 2026-11-10 (spec 003b) |
| D-052 | **Respaldo:** el sondeo de 15 s (D-043) solo corre mientras el canal no esté conectado; con el canal en vivo no hay sondeo periódico. | Usuario, 2026-11-10 (spec 003b) |
| D-053 | **Indicador «En vivo» / «Reconectando…»** (texto + ícono) y anuncio `aria-live` «Pedido #N: <estado>» cuando el estado cambia; sin sonidos ni notificaciones. | Usuario, 2026-11-10 (spec 003b) |
| D-054 | **Fin de sesión:** al cerrar sesión o salir de las pantallas del cliente se cierra el canal y se descarta la caché; el canal solo se abre para el rol cliente. | Usuario, 2026-11-10 (spec 003b) |
| D-055 | **La cocina es una sola pantalla en dos rutas:** `/operador/cocina` (operador) y `/admin/cocina` (admin), cada una tras su guarda de rol (D-012). «Cocina» aparece en la navegación de ambos. | Usuario, 2026-11-10 (spec 004) |
| D-056 | **Tablero en tres columnas** (Por preparar · En preparación · Listos), en pantallas estrechas como pestañas con contador, del pedido más antiguo al más nuevo. «Listos» solo tiene lo que espera al repartidor; usa tarjetas compactas, muestra los 10 más antiguos y «Ver los N listos» para el resto. | Usuario, 2026-11-10 (spec 004) |
| D-057 | **Tarjeta de cocina:** número, tiempo de espera, productos con componentes de combos, nota, zona/punto/piso, y nombre y teléfono del cliente (enlace `tel:`); sin precios ni datos de pago. En «Listos» compacto solo el nombre. | Usuario, 2026-11-10 (spec 004) |
| D-058 | **«Empezar» y «Marcar listo» sin confirmación**, botones grandes; la tarjeta cambia de columna con la respuesta del back; 409 → «Otro operador ya cambió este pedido» y se refresca. | Usuario, 2026-11-10 (spec 004) |
| D-059 | **Cancelar desde cocina** (Por preparar y En preparación, no Listos) con motivo obligatorio de 1 a 200 caracteres y aviso de reembolso. | Usuario, 2026-11-10 (spec 004) |
| D-060 | **En vivo:** `GET /kitchen/stream` con el cliente SSE del 003b; el proveedor se generaliza (URL y consultas a invalidar) y se abre solo en la pantalla de cocina. | Usuario, 2026-11-10 (spec 004) |
| D-061 | **Pedido nuevo:** anuncio `aria-live` «Nuevo pedido #N» y contador en el título de la pestaña si está oculta; sin sonido por ahora. | Usuario, 2026-11-10 (spec 004) |
| D-062 | **Espera larga con texto e ícono:** más de 5 min en Por preparar, 15 min en En preparación y 10 min en Listos; constantes fáciles de cambiar. | Usuario, 2026-11-10 (spec 004) |
| D-063 | **Nombre y teléfono del cliente visibles solo para el personal** en la pantalla de cocina, para validar algo con él. | Usuario, 2026-11-10 (spec 004) |
| D-064 | **Diseño para tablet y escritorio:** columnas amplias, tipografía legible a distancia, botones de al menos 48 px, solo tokens de color, sin desborde desde 360 px. | Usuario, 2026-11-10 (spec 004) |
| D-065 | **Dos pantallas para el personal:** «Productos» (disponibilidad rápida, `/operador/productos`) e «Inventario» (saldos, movimientos e historial, `/operador/inventario` y `/admin/inventario`). El admin recibe solo «Inventario»; su catálogo completo es del incremento 007. | Usuario, 2026-11-10 (spec 004b) |
| D-066 | **Estado de disponibilidad en palabras con ícono:** Disponible, Agotado (a mano), Sin saldo, Inactivo, Falta saldo de un componente (combo). Se deriva de `soldOut`, `active`, `stock` y `available`. | Usuario, 2026-11-10 (spec 004b) |
| D-067 | **«Marcar agotado» / «Volver a vender» sin confirmación** (idempotente y reversible), con aviso breve y botón deshabilitado mientras va la petición. | Usuario, 2026-11-10 (spec 004b) |
| D-068 | **Movimiento manual sin reintento automático** (`POST /movements` no es idempotente): marca síncrona contra doble envío, motivo obligatorio (1–300), saldo resultante visible en salidas, 409 explicado, y ante un fallo de red ambiguo se avisa que se revise el historial antes de reintentar. | Usuario, 2026-11-10 (spec 004b) |
| D-069 | **Sin canal en vivo para productos:** consulta al entrar, al volver a la pestaña y cada 30 s visible; indicador «Actualizado hace N s». Sin umbral de «poco saldo» (el back no lo tiene). | Usuario, 2026-11-10 (spec 004b) |
| D-070 | **Sin costos ni márgenes en pantalla** aunque el back los devuelva. | Usuario, 2026-11-10 (spec 004b) |
| D-071 | **Combos sin movimientos:** su saldo es calculado a partir de los componentes; el front no ofrece «Registrar movimiento» en combos y lo muestra solo lectura. El precio del combo (suma por defecto o fijado aparte) no depende del inventario. El back no necesita cambios; verificar su respuesta ante un movimiento sobre un combo (P-06). | Usuario, 2026-11-10 (spec 004b) |
| D-072 | **Historial** de 20 por página con filtros por producto y tipo, fecha en America/Bogota, tipo con texto + ícono, responsable y, si viene de un pedido, la marca «Automático» con el identificador del pedido (sin enlace: el personal aún no tiene detalle de pedido). | Plan 004b |
| D-073 | **Rutas y navegación:** «Productos» e «Inventario» se habilitan para el operador y «Inventario» se agrega al admin. | Usuario, 2026-11-10 (spec 004b) |
| D-074 | **Diseño:** tarjetas en 360 px y tabla en pantallas anchas, botones ≥ 48 px, solo tokens de color, sin desborde horizontal. | Usuario, 2026-11-10 (spec 004b) |
| D-075 | **El inventario es el abasto de producción del día** (opción A, sin cambios en el back): el saldo de un producto significa «cuántos podemos entregar hoy» y se sigue moviendo con entradas y salidas. Ingredientes y recetas quedan como evolución posible (requiere el back). | Usuario, 2026-11-10 (spec 004c) |
| D-076 | **Vocabulario:** «Saldo» → «Disponibles»; `IN` → «Producción»; `OUT` → «Merma o salida», en formulario, filas e historial. | Usuario, 2026-11-10 (spec 004c) |
| D-077 | **Motivos sugeridos** como botones sobre el campo de motivo (siguen siendo texto libre, obligatorio, 1–300): producción «Producción del día», «Reposición»; salida «Merma», «Consumo interno», «Ajuste por conteo». | Usuario, 2026-11-10 (spec 004c) |
| D-078 | **«Preparar el día»:** sección de «Inventario» con un campo «Para hoy» por producto simple activo (vacío = no cambiar), diferencia visible por fila y un motivo para todo el lote («Preparar el día» por defecto). | Usuario, 2026-11-10 (spec 004c) |
| D-079 | **Aplicar en lote:** resumen previo, nueva consulta del catálogo y **un movimiento por producto, de uno en uno**; la diferencia se calcula con el saldo más reciente (el back no tiene «fijar saldo»). | Usuario, 2026-11-10 (spec 004c) |
| D-080 | **Errores parciales sin reintento automático:** el lote continúa tras un fallo; cada fila muestra su resultado; un corte de red marca la fila como ambigua (no se reenvía hasta confirmar que se revisó el historial); los fallos definitivos (4xx) se pueden volver a aplicar. | Usuario, 2026-11-10 (spec 004c) |
| D-081 | **Sin duplicar:** botón deshabilitado con marca síncrona mientras corre el lote y filas aplicadas limpiadas al terminar. | Usuario, 2026-11-10 (spec 004c) |
| D-082 | **Acceso:** «Preparar el día» vive en `/operador/inventario` y `/admin/inventario` como tercera sección. | Usuario, 2026-11-10 (spec 004c) |
| D-083 | **Límites y diseño:** «Para hoy» entero de 0 a 100 000; combos e inactivos no aparecen; tarjetas en 360 px, botones ≥ 48 px, solo tokens de color. | Usuario, 2026-11-10 (spec 004c) |

## Reemplazadas

| ID | Decisión original | Reemplazada por |
|---|---|---|
| D-003 | Despliegue en Vercel (incremento 9); el dominio se añade a `CORS_ORIGINS` del back. | D-022 (2026-11-09: con BFF no hace falta CORS y el SSE por el proxy encaja mejor en un contenedor persistente) |
| D-004 | Token de sesión en `sessionStorage`. | D-014 (2026-11-09, tras evaluar riesgos de XSS) |

## Pendientes abiertos

| ID | Pendiente | Cuándo |
|---|---|---|
| P-01 | ~~Cambio en el back para la IP real~~ **Resuelto sin cambios en el back** (ver D-023): el back ya soporta `TRUST_PROXY_HOPS` (D-56 del back) y vale `1` en Railway. Verificar en el despliegue que la IP que ve el back es la del cliente. | Incremento 9 |
| P-02 | ~~Hosting~~ **Resuelto por D-022 (Railway).** Verificar en el incremento 3 el límite de duración de petición del proxy de Railway. | Incremento 3 |
| P-03 | ~~Verificar qué devuelve `/auth/me` como `username` de un cliente~~ **Resuelto (D-026):** devuelve un identificador interno; se muestra `fullName` de `GET /customers/me`. | Incremento 1 |
| P-04 | Verificar en Railway que `request.nextUrl` (redirecciones de `proxy.ts`) use el host público y no el interno; si no, construir el origen desde `X-Forwarded-Host`/`X-Forwarded-Proto`. | Despliegue (incremento 9) |
| P-05 | Confirmar contra el back real qué trae el evento `order` de `/orders/stream` (¿`id`?, ¿`number`?, ¿`status`?). El diseño no depende de ello (D-049); solo afina el anuncio. | Prueba manual del 003b |
| P-06 | Confirmar contra el back real qué responde `POST /movements` sobre un **combo** (se espera 4xx) y que `GET /products` trae el combo con `stock` calculado. Si lo acepta, pedir al back que lo rechace. | Prueba manual del 004b |
