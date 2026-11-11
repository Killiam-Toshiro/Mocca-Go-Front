# Spec 005 — Repartidor

**Repo:** `mocca-go-front` · **Fecha:** 2026-11-10 · **Estado:** aprobada el 2026-11-10 (v1.1; DP-03 con ambas formas de salir, DP-07 con confirmación y DP-06 con teléfono visible; las DP pasan a D-084 en adelante)
**Contrato consumido:** `docs/openapi.json` (módulo `dispatch`) y `docs/frontend-handoff.md` §3, §6–7 · **Siguiente paso tras aprobar:** `plan.md` → `tasks.md`

---

## 1. Objetivo

Que el **repartidor** vea los pedidos que ya están listos en cocina, **arme su ronda** (hasta 5 pedidos de una misma zona), salga a repartir y vaya cerrando cada pedido como **«Entregado»** o **«No entregado»** (con motivo). La pantalla se mantiene al día sola (canal SSE de despacho) y cada cambio se refleja en el seguimiento del cliente (003b) y en la cocina sin recargar. El diseño es **primero para el celular**, porque el repartidor trabaja caminando.

## 2. Decisiones ya tomadas

| ID | Decisión | Origen |
|---|---|---|
| D-012 | Cada rol solo visita su prefijo; el repartidor solo `/repartidor`. | Spec 001 |
| D-014 / D-016 | El navegador solo habla con `/api/...`; la pasarela agrega el `Bearer` y solo deja pasar rutas del contrato. Las 7 operaciones de `dispatch` ya están en la tabla. | Spec 001 |
| D-046 | Estados con texto + ícono, nunca solo color. | Spec 003 |
| D-047 a D-054 | Cliente SSE propio, un canal por pestaña, un evento = volver a consultar, reconexión, vigilante de latido, respaldo con sondeo, indicador «En vivo». | Spec 003b |
| D-055 a D-064 | Patrón de cocina: acciones sin doble clic (marca síncrona), 409/404 con aviso de pantalla («Entendido»), aviso de pedido nuevo con contador en el título. | Spec 004 |
| D-070 | Una petición no idempotente no se reintenta sola; ante un corte de red se revisa el estado antes de repetir. | Spec 004b |

## 3. Alcance

**Entra**
- Dos pantallas del repartidor: **«Cola de despacho»** (`/repartidor/cola`) y **«Mis rondas»** (`/repartidor/rondas`); ambas habilitadas en la navegación (hoy «Próximamente»).
- Cola por zona con los pedidos `listo`, la zona sugerida marcada, y la creación de la ronda (sugerida o con pedidos elegidos).
- Rondas activas (máximo 2) con sus pedidos, la hora estimada de llegada y las acciones «Entregado» / «No entregado».
- En vivo por `GET /dispatch/stream`, aviso de pedido nuevo listo, indicador «En vivo» y respaldo con sondeo.
- Mock de la API ampliado y pruebas (unitarias, de componente y E2E).

**No entra**
- Ver rondas desde el operador o el admin (el contrato lo permite): van con el listado de pedidos del admin (007). Hoy solo las ve el repartidor.
- Historial de rondas finalizadas y métricas de reparto (008).
- Mapa, navegación GPS o seguimiento de ubicación (el back no lo ofrece).
- Tratamiento de los pedidos `no_entregado` (reembolso, reposición): el back lo deja pendiente; aquí solo se registran con su motivo.
- Notificaciones del navegador o sonido.

## 4. Contrato consumido

| Operación | Comportamiento |
|---|---|
| `GET /dispatch/queue` | `{ suggestedZoneId \| null, zones: [{ zoneId, zoneName, oldestNumber, orders: OrderResponse[] }] }`. Zonas ordenadas por su pedido `listo` más antiguo; pedidos del más antiguo al más nuevo. `suggestedZoneId` = zona del `listo` más antiguo. |
| `POST /dispatch/rounds` con `{}` o `{ orderIds }` | Sin `orderIds`: toma la sugerencia (zona del `listo` más antiguo, hasta 5 pedidos). Con `orderIds` (1–5): ruta propia, todos `listo` y de **una sola zona**. Los pedidos pasan a `en_camino` con ETA de salida + 15 min. Responde la `RoundResponse` (201). **409:** no hay pedidos listos, algún pedido ya no está `listo` o son de varias zonas, perfil incompleto (falta nombre o teléfono) o ya tiene 2 rondas activas. 404: algún `orderId` no existe. 400. |
| `GET /dispatch/rounds?status=&page=&limit=` | El repartidor ve las suyas; por defecto las `activa`. La más reciente primero. |
| `GET /dispatch/rounds/{id}` | Ronda con sus pedidos. 404 si no existe o es de otro repartidor. |
| `POST /dispatch/orders/{id}/deliver` | `en_camino → entregado`. Responde el pedido. 409 si ya no está `en_camino`; 404 si no existe o es de una ronda ajena. |
| `POST /dispatch/orders/{id}/fail` con `{ reason }` | `en_camino → no_entregado`. `reason` obligatorio (1–200). No mueve inventario ni pago. 409 / 404 / 400 como arriba. |
| `GET /dispatch/stream` | `text/event-stream`: `ready` al abrir y al reconectar, un evento `order` por cada cambio de estado, latido cada 25 s. Máximo 5 canales por usuario. |

`RoundResponse`: `id`, `status` (`activa` \| `finalizada`), `zone {id,name}`, `courier {id,fullName,phone}`, `startedAt`, `etaAt` (salida + 15 min, constante), `finishedAt`, `orders: OrderResponse[]`. La ronda **se cierra sola** cuando todos sus pedidos terminan. El contenido del evento `order` no se usa (D-049): cada evento vuelve a consultar.

## 5. Decisiones de diseño propuestas (requieren tu visto bueno)

| ID | Propuesta | Alternativa |
|---|---|---|
| DP-01 | **Dos pantallas** que ya tienes en el menú: «Cola de despacho» (qué hay listo y salir) y «Mis rondas» (lo que llevo en la calle). Al crear la ronda, la app te lleva a «Mis rondas». | Una sola pantalla con dos pestañas. |
| DP-02 | **Cola por zona:** una tarjeta por zona, ordenadas como el back (la del pedido más antiguo primero), la **sugerida marcada con texto e ícono** («Sugerida: lleva el pedido más antiguo»). Cada pedido en la zona se muestra compacto: número, punto y piso, tiempo esperando listo («hace 6 min») y, si lo hay, la indicación de entrega. Sin precios ni datos de pago. | Una lista plana de pedidos con la zona como etiqueta. |
| DP-03 | **Dos maneras de salir (el back soporta ambas):** (a) **«Salir con la sugerencia»**, un botón que no envía pedidos y deja decidir al back (zona del más antiguo, hasta 5); (b) **«Elegir pedidos»** en cualquier zona: casillas por pedido, máximo 5, y al marcar uno de una zona las demás zonas quedan deshabilitadas con el texto «Una ronda es de una sola zona». Contador «3 de 5» y botón «Salir con 3 pedidos». | Solo la sugerencia (más simple; el repartidor no puede escoger ruta). |
| DP-04 | **Reglas de la ronda visibles antes de equivocarse:** si ya hay 2 rondas activas, los botones de salir quedan deshabilitados con «Ya tienes 2 rondas activas: termina una para salir de nuevo». Los 409 del back (pedido tomado por otro repartidor, perfil incompleto, etc.) se explican con el mensaje del back en un aviso de pantalla («Entendido») y la cola se refresca. **Perfil incompleto** se explica con una frase propia («Falta tu nombre o teléfono: pídele al admin que los complete»). | Dejar que el back rechace y mostrar solo su mensaje. |
| DP-05 | **Mis rondas:** una tarjeta por ronda activa con zona, hora de salida, **llegada estimada** («Llegada estimada 3:45 p. m.») y avance («2 de 4 entregados»). Si la hora estimada pasó y quedan pedidos, se marca con texto e ícono («Vencida hace 4 min»). Dentro, un bloque por pedido. Cuando todos terminan la ronda desaparece de la lista y se avisa «Ronda terminada: N entregados, M no entregados». | Mostrar también las rondas finalizadas del día. |
| DP-06 | **Pedido dentro de la ronda:** número grande; punto, zona y **piso**; **indicación de entrega**; **nombre y teléfono del cliente** (teléfono como enlace `tel:` y enlace a WhatsApp, para ubicarlo); productos en una línea resumida; sin precios ni datos de pago. Los pedidos ya cerrados se ven atenuados con su resultado («Entregado» / «No entregado: motivo») y sin botones. | Sin datos del cliente. |
| DP-07 | **«Entregado» con confirmación en línea de un toque** («¿Entregaste el pedido #1042? Sí, entregado / Volver»), porque no se puede deshacer y dispara la encuesta del cliente; **«No entregado» pide motivo** (obligatorio, 1–200, con contador y motivos sugeridos: «El cliente no estaba en el punto», «No contestó el teléfono», «Dirección incorrecta»; el texto sigue siendo libre). Botones ≥ 48 px, sin doble clic (marca síncrona, D-081). | «Entregado» de un solo toque como en cocina. |
| DP-08 | **Errores de cierre:** **409** («este pedido ya no está en camino», p. ej. el admin lo cambió) y **404** (pedido de una ronda ajena o inexistente) se explican en un aviso de pantalla («Entendido») y la ronda se refresca, igual que en cocina (D-058). Un **corte de red** al entregar o fallar **no se reintenta solo**: se consulta de nuevo la ronda y, si el pedido ya cambió, se muestra su estado real; si no, aparece «Reintentar». | Reintento automático. |
| DP-09 | **En vivo:** `GET /dispatch/stream` con el mismo cliente SSE (el proveedor del 003b ya está generalizado desde cocina); un evento vuelve a consultar cola y rondas; indicador «En vivo» / «Reconectando…»; respaldo con sondeo de 15 s si el canal no está conectado. Cada pantalla se mantiene al día aunque la otra no esté abierta. | Solo sondeo. |
| DP-10 | **Aviso de pedido nuevo listo:** anuncio `aria-live` «Pedido #N listo para repartir» y contador en el título de la pestaña («(2) Cola de despacho»); la carga inicial no lo dispara; **sin sonido**. | Sin aviso. |
| DP-11 | **Diseño móvil primero (360 px):** tarjetas apiladas, acciones grandes al alcance del pulgar, sin desborde horizontal, solo tokens de color, textos legibles al sol (contraste AA). En escritorio, las zonas se muestran en rejilla de dos columnas. | — |

## 6. Rutas y comportamiento

| Ruta | Quién | Qué muestra |
|---|---|---|
| `/repartidor/cola` | Repartidor | Cola por zona y creación de ronda. |
| `/repartidor/rondas` | Repartidor | Rondas activas y cierre de pedidos. |

**Reglas**
- Al abrir cada pantalla se consulta lo suyo (cola; rondas activas). Con el canal en vivo no hay sondeo periódico; cada evento vuelve a consultar (D-052).
- Crear una ronda **no es idempotente**: botón con marca síncrona, un solo envío; con un corte de red no se reintenta solo, se consulta primero «Mis rondas» y la cola para saber si salió (como en 004b).
- Tras crear la ronda se actualizan cola y rondas con la respuesta y se navega a «Mis rondas».
- Una cola vacía dice «No hay pedidos listos para repartir».
- Los pedidos `listo` de más de 10 min se marcan como espera larga (texto + ícono), constante fácil de cambiar.
- **Fechas:** America/Bogota; la llegada estimada y los tiempos se calculan con las horas del back (`etaAt`, `startedAt`, último evento `listo`).
- **Seguridad:** solo repartidor; el back impone el permiso. El teléfono del cliente solo se muestra aquí y no se guarda fuera de la caché de la pantalla. Los motivos se envían y muestran como texto.

## 7. Criterios de aceptación

| ID | Criterio (verificable) |
|---|---|
| CA-01 | `/repartidor/cola` y `/repartidor/rondas` solo los ve el repartidor (visitante → login; otros roles → su panel); «Cola de despacho» y «Mis rondas» quedan habilitados y salen de «Próximamente». |
| CA-02 | La cola sale de `GET /dispatch/queue`: una tarjeta por zona en el orden del back, la sugerida marcada con texto e ícono, pedidos con número, punto, piso, indicación y tiempo esperando; sin precios ni datos de pago; vacío con mensaje. |
| CA-03 | «Salir con la sugerencia» envía `POST /dispatch/rounds` sin `orderIds`; «Elegir pedidos» envía `{ orderIds }` con 1–5 pedidos de una sola zona (las demás zonas quedan deshabilitadas con explicación y no se pasa de 5). |
| CA-04 | Con 2 rondas activas los botones de salir están deshabilitados con explicación; los 409 del back (sin listos, pedido ya tomado, perfil incompleto, 2 rondas) se muestran en un aviso de pantalla y refrescan la cola. |
| CA-05 | Al crear la ronda se navega a «Mis rondas», donde aparece con zona, salida, llegada estimada y avance; los pedidos pasan a `en_camino`. Doble clic en «Salir» envía una sola petición; un corte de red no reintenta solo y consulta el estado antes de permitir repetir. |
| CA-06 | Cada pedido de la ronda muestra número, punto, zona y piso, indicación de entrega, nombre y teléfono del cliente (`tel:` y WhatsApp) y productos resumidos; sin precios ni datos de pago. |
| CA-07 | «Entregado» pide confirmación en línea y llama a `deliver`; «No entregado» exige motivo (1–200, contador) y llama a `fail`; botones deshabilitados mientras dura y doble clic envía una sola petición; el pedido cerrado queda atenuado con su resultado. |
| CA-08 | 409 y 404 al cerrar un pedido muestran un aviso de pantalla («Entendido») y refrescan la ronda; un corte de red no reintenta solo, consulta la ronda y ofrece «Reintentar» si el pedido sigue en camino; 400 muestra el mensaje del back. |
| CA-09 | Cuando todos los pedidos de una ronda terminan, la ronda sale de la lista y se anuncia «Ronda terminada: N entregados, M no entregados». |
| CA-10 | La llegada estimada se muestra en hora de Bogotá y, pasada con pedidos pendientes, se marca «Vencida hace N min» con texto e ícono; los tiempos se refrescan cada 30 s. |
| CA-11 | En vivo: un pedido que la cocina marca listo, o un cambio hecho por otro lado, aparece en menos de 3 s sin recargar (E2E con el mock); con el canal caído el sondeo de 15 s mantiene al día; indicador «En vivo» / «Reconectando…». |
| CA-12 | Aviso de pedido nuevo listo: anuncio `aria-live` y contador en el título; la carga inicial no lo dispara; el contador se limpia al volver a mirar la pestaña. |
| CA-13 | Lo que hace el repartidor se ve en el seguimiento del cliente (003b) abierto en otro navegador: «En camino» con repartidor y llegada estimada, y luego «Entregado» o «No entregado» (E2E con dos contextos). |
| CA-14 | Accesibilidad: roles y nombres con el número de pedido («Entregado #1042», «Elegir pedido #1042»), foco gestionado tras cada acción, estados con texto + ícono, contraste AA, botones ≥ 48 px, sin desborde en 360 px. |
| CA-15 | Solo tokens de color; `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `audit` y `e2e` en verde. |
| CA-16 | Pruebas: unitarias (reglas de selección de pedidos, estado de la ronda y vencimiento, mapeo de errores de despacho), de componente (cola, selección, ronda, cierre de pedido) y E2E contra el mock (salir con sugerencia, elegir pedidos, entregar, no entregar con motivo, 409, en vivo, dos contextos, 360 px). |

## 8. Verificación contra el back real

Con el back local, el seed y un usuario `repartidor` con **nombre y teléfono** completos (si no, el back responde 409 «perfil incompleto»; es parte de la prueba):
1. Con 2 o 3 pedidos de una misma zona pasados a «Listo» desde cocina: deben aparecer en `/repartidor/cola` en menos de 3 s con el aviso «Pedido #N listo para repartir» y el contador en el título.
2. «Salir con la sugerencia»: los pedidos pasan a «En camino», aparece la ronda en «Mis rondas» y el cliente ve «En camino» con el nombre del repartidor y la llegada estimada.
3. «Entregado» en uno: el cliente ve «Entregado» y puede calificar. «No entregado» en otro con motivo: el cliente ve «No entregado» con el motivo.
4. Con pedidos de **dos zonas** listos: «Elegir pedidos» no deja mezclar zonas y deja salir con los de una.
5. Crear 2 rondas activas: el botón de salir se deshabilita con la explicación. Terminar una: se habilita.
6. Cerrar todos los pedidos: la ronda desaparece y se anuncia «Ronda terminada».
7. Conflicto: con dos pestañas del mismo repartidor, entregar el mismo pedido en ambas: la segunda explica que ya no está en camino.
8. **P-07 (resuelto leyendo el código del back; falta confirmarlo en ejecución):** un pedido tomado por otro repartidor mientras elegías debe dar **409** `Los pedidos #N ya no están en estado «listo»`. Ver `plan.md`, Anexo A.

## 9. Riesgos y pendientes

- **Perfil incompleto:** un repartidor sin `fullName` o `phone` no puede salir; hasta que exista el CRUD de usuarios del admin (007) se resuelve con el seed o con el back.
- **Pedidos `no_entregado`:** el back no reembolsa ni repone; solo se registran con motivo. Su tratamiento es un pendiente de negocio, no de este incremento.
- **ETA fija de 15 min:** el back la calcula como constante; la marca «Vencida» es informativa, no cambia nada en el back.
- **Competencia entre repartidores:** el back responde 409 con el número de los pedidos tomados (verificado en su código, `plan.md` Anexo A); en «sugerencia» puede salir con menos pedidos o decir «No hay pedidos listos» aunque la cola aún los muestre, porque salta los bloqueados.
- **Límite de 5 canales por usuario:** el respaldo con sondeo lo cubre.
- **Operador y admin no ven rondas todavía** (aunque el contrato lo permite): llegan con 007.

## 10. Siguiente paso

`plan.md` → tu visto bueno → `tasks.md` → código y pruebas; me detengo para tu revisión.
