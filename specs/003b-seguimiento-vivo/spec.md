# Spec 003b — Seguimiento en vivo (SSE)

**Repo:** `mocca-go-front` · **Fecha:** 2026-11-10 · **Estado:** aprobada el 2026-11-10 (DP-01 a DP-08; DP-02 con **45 s**) · DP-01 a DP-08 pasan a D-047 a D-054
**Contrato consumido:** `docs/openapi.json` (`GET /orders/stream`) y `docs/frontend-handoff.md` §7 · **Siguiente paso tras aprobar:** `plan.md` → `tasks.md`

---

## 1. Objetivo

Que el cliente vea cambiar su pedido **al instante, sin recargar**: «Mis pedidos» y el detalle se actualizan cuando cocina o reparto cambian el estado, y la pantalla lo anuncia («Tu pedido #1001 está En camino»). Hoy (003) el detalle consulta cada 15 s; el canal en tiempo real lo reemplaza, y la consulta periódica queda solo como **respaldo** si el canal falla.

## 2. Decisiones ya tomadas

| ID | Decisión | Origen |
|---|---|---|
| D-014 / D-016 | El navegador solo habla con `/api/...`; la pasarela agrega el `Bearer`. `GET /orders/stream` ya está en la tabla de rutas con `stream: true`. | Spec 001 |
| D-037 | El SSE se separa en este incremento; el 003 deja un sondeo de 15 s. | Usuario, 2026-11-10 |
| D-043 | Detalle con línea de tiempo; estados finales: `entregado`, `cancelado`, `no_entregado`. | Spec 003 |

## 3. Alcance

**Entra**
- Cliente de SSE propio (sobre `fetch` y lectura del flujo) con reconexión de espera creciente y detección de canal «mudo».
- Un único canal por pestaña mientras el cliente esté en sus pantallas de pedidos, compartido por la lista y el detalle.
- Actualización en vivo de «Mis pedidos» y del detalle (estado, línea de tiempo, repartidor y hora estimada).
- Indicador de conexión («En vivo» / «Reconectando…») y anuncio accesible de los cambios de estado.
- Sondeo de 15 s **solo mientras el canal no esté conectado** (respaldo).
- Mock de la API con `GET /orders/stream` y pruebas (unitarias, de componente y E2E).

**No entra**
- Canales de cocina y despacho (incrementos 004 y 005; reutilizarán el cliente SSE).
- Notificaciones del navegador, sonidos o vibración.
- Guardar eventos sin conexión ni «ponerse al día» más allá de volver a consultar.
- Encuesta del cliente (006).

## 4. Contrato consumido

| Operación | Comportamiento |
|---|---|
| `GET /orders/stream` (solo cliente) | Respuesta `text/event-stream`. Evento `ready` al abrir y en cada reconexión de la escucha (el cliente vuelve a consultar). Evento `order` «con número, estado y hora» cuando cambia el estado de **uno de sus** pedidos. Comentario de latido cada 25 s. Si se revoca la sesión, el servidor cierra el canal. Máximo **5 canales por usuario**. |
| Errores | 401 (sesión vencida o cerrada), 403 (rol sin permiso), 429 (demasiados canales o aperturas por minuto). |

**Lo que el contrato NO dice:** la forma exacta del dato del evento `order` (solo «número, estado y hora»; no aclara si trae el `id` del pedido). Por eso el diseño **no depende del contenido**: ante cualquier evento se vuelve a consultar el pedido al back (DP-03). El contenido solo se usa, si viene bien formado, para el anuncio de accesibilidad. Se confirma contra el back real (P-05, §8).

**Pasarela:** `forward.ts` ya corta el temporizador de 30 s al recibir las cabeceras, envía `x-accel-buffering: no` y cancela la llamada al back si el navegador se desconecta (pruebas existentes en `forward.test.ts`). No requiere cambios; se verifica con una prueba de extremo a extremo y, al desplegar, el límite de duración de Railway (P-02).

## 5. Decisiones de diseño propuestas (requieren tu visto bueno)

| ID | Propuesta | Alternativa |
|---|---|---|
| DP-01 | **Cliente SSE propio sobre `fetch`** (~100 líneas, sin dependencias nuevas): el navegador pide `/api/orders/stream` con la cookie; el cliente lee el flujo, interpreta `event:`/`data:` y conoce el **código HTTP** (para distinguir 401, 403 y 429). | `EventSource` nativo (más corto, reconecta solo, pero no deja ver el código HTTP: no distingue sesión vencida de límite de canales). |
| DP-02 | **Un canal por pestaña**, abierto por un proveedor dentro del layout del cliente (cubre lista y detalle), **solo mientras la pestaña esté visible**: al ocultarse se cierra tras 45 s (el back permite solo 5 canales por usuario) y al volver se reabre y llega `ready`. | Canal abierto siempre; o uno por pantalla. |
| DP-03 | **Un evento = volver a consultar.** `ready` → invalidar la lista y el pedido abierto; `order` → lo mismo (por el `id` si viene; si no, todos los pedidos en caché). La pantalla siempre muestra datos del back, nunca construidos a partir del evento. | Parchear la caché con el estado del evento (menos peticiones, pero depende de un formato no documentado). |
| DP-04 | **Reconexión con espera creciente y variación:** 1 s, 2 s, 4 s… hasta 30 s. **401** → flujo de sesión vencida (como el resto de la app) y no se reintenta; **403** → no se reintenta (queda el respaldo); **429** → espera 60 s. Se reinicia la espera al recibir `ready`. | Intervalo fijo. |
| DP-05 | **Vigilante de latido:** si pasan 60 s sin recibir nada (el back manda un latido cada 25 s) se cierra y se reconecta, para no quedarse con un canal «muerto» (p. ej. tras suspender el equipo o por un proxy). | Confiar en que el navegador avise. |
| DP-06 | **Respaldo:** mientras el canal **no** esté conectado (conectando, reconectando, caído), el detalle de un pedido no terminado sigue consultando cada 15 s (D-043); con el canal conectado no hay sondeo periódico. Al volver a la pestaña se consulta igual. | Sin respaldo. |
| DP-07 | **Indicador y anuncio:** en el detalle y la lista, una etiqueta con texto + ícono: «En vivo» (conectado) o «Reconectando…» (con el sondeo activo). Cuando el estado de un pedido cambia por un evento, una región `aria-live="polite"` dice «Pedido #1001: En camino». Sin sonidos ni notificaciones. | Sin indicador. |
| DP-08 | **Fin de sesión:** al cerrar sesión se cierra el canal y se descartan los datos en caché del cliente; el canal solo se abre para el rol cliente. | — |

## 6. Comportamiento

- **Abrir:** el proveedor abre el canal al entrar a cualquier ruta `/cliente/...` con sesión y pestaña visible. Si el rol no es cliente, nunca se abre.
- **`ready`:** marca «En vivo», reinicia la espera de reconexión e invalida las consultas de pedidos.
- **`order`:** invalida las consultas de pedidos afectadas; al llegar el dato nuevo, el detalle actualiza la línea de tiempo, el repartidor y la hora estimada (003 ya sabe pintarlos) y se anuncia el cambio.
- **Caída o cierre del servidor:** «Reconectando…», sondeo de respaldo y reintentos (DP-04).
- **Pestaña oculta:** se cierra a los 45 s; al volver, reabre y consulta.
- **Varias pestañas:** cada una abre su canal (máximo 5 por usuario); si el back responde 429 la pestaña funciona con el sondeo de respaldo y lo indica.

## 7. Criterios de aceptación

| CA | Criterio |
|---|---|
| CA-01 | Con el detalle abierto, cuando el pedido cambia de estado en el back, la pantalla lo refleja en **menos de 3 s**, sin recargar y sin esperar al sondeo de 15 s. |
| CA-02 | Con «Mis pedidos» abierto, el estado de una fila cambia en vivo y un pedido nuevo (hecho en otra pestaña) aparece arriba. |
| CA-03 | El cambio de estado se anuncia en una región `aria-live` («Pedido #N: <estado>») y no se repite si el estado no cambió. |
| CA-04 | El indicador muestra «En vivo» con el canal conectado y «Reconectando…» si no lo está; con texto e ícono, no solo color. |
| CA-05 | Si el canal cae, el cliente reintenta con espera creciente (1 s hasta 30 s con variación) y, mientras tanto, el detalle sigue actualizándose cada 15 s. Al reconectar, `ready` hace una consulta de puesta al día y se detiene el sondeo. |
| CA-06 | Un 401 en el canal lleva al inicio de sesión como el resto de la app y no se reintenta; un 403 no se reintenta; un 429 espera 60 s; en los tres casos la app sigue funcionando con el sondeo de respaldo (salvo el 401, que sale). |
| CA-07 | Un canal sin latidos durante 60 s se cierra y se reabre solo. |
| CA-08 | Con la pestaña oculta más de 45 s el canal se cierra; al volver se reabre y los datos se actualizan. |
| CA-09 | Nunca hay más de un canal por pestaña (navegar entre lista y detalle no abre canales nuevos) y se cierra al cerrar sesión o salir de las pantallas del cliente. |
| CA-10 | Un evento mal formado o desconocido no rompe nada: se ignora o solo provoca una nueva consulta. El contenido del evento nunca se pinta como HTML. |
| CA-11 | El analizador SSE cumple el formato: líneas `event:`/`data:`/comentarios (`:`), varios `data:` en un evento, fin de línea `\n`, `\r\n` o `\r`, y bloques partidos entre lecturas. |
| CA-12 | Pasarela: el flujo llega por partes (sin buffer) y se corta al desconectarse el navegador. |
| CA-13 | Calidad: formato, lint, tipos, pruebas unitarias, de componente y E2E, `build`, `check:bundle` y `npm audit` en verde, igual que en 001–003. |

## 8. Verificación contra el back real

1. Abrir el detalle de un pedido «Recibido» y, con Postman como operador, `start`: debe pasar a «En preparación» en menos de 3 s.
2. Seguir con `ready`, y con repartidor tomar el pedido (`en_camino`): deben aparecer repartidor, teléfono, WhatsApp y hora estimada sin recargar; después `deliver`.
3. Con «Mis pedidos» abierto, crear un pedido desde otra pestaña: debe aparecer arriba.
4. Apagar el back un momento: aparece «Reconectando…»; al volver, «En vivo» y los datos al día.
5. Cerrar sesión desde otra pestaña (o revocar): el canal se cierra y la app pide ingresar.
6. **P-05:** ver en la pestaña de red del navegador un evento `order` real y confirmar qué trae (¿`id`?, ¿`number`?, ¿`status`?). Si me lo pegas, ajusto el anuncio.

## 9. Riesgos y pendientes

- **P-05 (nuevo):** forma exacta del evento `order`. El diseño no depende de ella; solo mejora el anuncio.
- **P-02:** el límite de duración de petición del proxy de Railway puede cortar el canal; el cliente ya reconecta, pero se verifica al desplegar.
- **Límite de 5 canales por usuario:** abrir muchas pestañas da 429 en las nuevas (se cubre con el respaldo).
- **Equipos que suspenden:** el vigilante de latido (DP-05) evita canales «muertos».
- **Sin recuperación de eventos perdidos:** al reconectar solo se vuelve a consultar el estado actual, que es lo que importa al cliente.

## 10. Siguiente paso

`plan.md` → tu visto bueno → `tasks.md` → código.
