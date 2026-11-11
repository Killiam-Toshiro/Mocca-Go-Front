# Plan 005 — Repartidor

**Spec:** `specs/005-repartidor/spec.md` (aprobada el 2026-11-10, con tus respuestas: ambas formas de salir, confirmación en «Entregado», teléfono visible) · **Estado del plan:** borrador, pendiente de tu aprobación

Vocabulario: **cola** = los pedidos `listo` agrupados por zona que trae `GET /dispatch/queue`. **Ronda** = el viaje del repartidor con hasta 5 pedidos de una zona. **Canal** = la conexión SSE a `/api/dispatch/stream`.

## 1. Enfoque técnico

| Bloque | Qué se construye | Archivos clave |
|---|---|---|
| A. Lógica pura | `MAX_ROUND_ORDERS = 5`, `MAX_ACTIVE_ROUNDS = 2`; `toggleSelection(selection, order)` (una sola zona, tope de 5), `canSelect(selection, zoneId)` con el motivo si no se puede; `roundProgress(round)` (cerrados, entregados, no entregados, pendientes), `isOverdue(round, now)` y `overdueMinutes`; `waitSince` del pedido listo (último evento `listo`, reutiliza `sinceFor`/`waitLabel` de cocina); `customerWhatsapp(phone)` (`https://wa.me/<dígitos>`) y `isDialable(phone)`. | `src/lib/dispatch/selection.ts`, `rounds.ts`, `contact.ts` (+ pruebas) |
| B. Errores | `describeDispatchError(error, { action })` → `{ kind, messages }` con `kind`: `conflict` (409), `missing` (404), `validation` (400), `ambiguous` (red o 5xx en una acción que cambia estado), `network`, `other`. En `crear ronda`, el 409 se subclasifica por el texto del back: **perfil incompleto** (nombre/teléfono) → frase propia («Falta tu nombre o teléfono: pídele al admin que los complete»), **2 rondas activas**, **pedidos ya no listos**, **sin pedidos listos**; si no reconoce el texto, muestra el del back. | `src/lib/dispatch/errors.ts` (+ pruebas) |
| C. Datos | `useDispatchQueue()` (`GET /api/dispatch/queue`, clave `['dispatch','queue']`), `useActiveRounds()` (`GET /api/dispatch/rounds?status=activa&limit=100`, clave `['dispatch','rounds']`). Ambas con sondeo de 15 s **solo** si el canal no está `live` (D-052), `refetchIntervalInBackground: false` y datos anteriores mientras consultan. `useCreateRound({ onDone, onFail })`: `POST /api/dispatch/rounds` con `{}` o `{ orderIds }`, marca síncrona (`useRef`) contra doble clic, sin reintento; al terminar actualiza la caché de rondas con la respuesta, quita los pedidos tomados de la cola e invalida. `useCloseOrder('deliver' \| 'fail')`: `POST /api/dispatch/orders/{id}/deliver` o `/fail` `{ reason }`, misma marca, reemplaza el pedido dentro de su ronda en la caché y, si todos quedaron cerrados, quita la ronda y devuelve el resumen para el anuncio. | `src/lib/dispatch/use-dispatch-queue.ts`, `use-active-rounds.ts`, `use-create-round.ts`, `use-close-order.ts` (+ `hooks.test.tsx`) |
| D. Corte de red | Crear ronda y cerrar pedido **no se reintentan solos** (D-070). Crear ronda: ante `ambiguous` se consultan las rondas con `staleTime: 0` y se compara con las que había; si apareció una nueva se anuncia «La ronda sí salió» y se navega a «Mis rondas»; si no, «La ronda no salió: puedes intentar de nuevo». Cerrar pedido: se consulta la ronda; si el pedido ya no está `en_camino` se muestra su estado real; si sigue en camino aparece «Reintentar». | `use-create-round.ts`, `use-close-order.ts` |
| E. Avisos | `useNewReadyOrders()`: se suscribe a la caché de `['dispatch','queue']`; la primera carga solo registra los ids; un pedido nuevo en cualquier zona anuncia «Pedido #N listo para repartir» y, con la pestaña oculta, suma al contador del título («(2) Cola de despacho»). Se limpia al volver. Mismo patrón que `useNewKitchenOrders` (sin `setState` en efectos). Se reutiliza `useNow(30_000)` para los «hace X min» y el «Vencida». | `src/lib/dispatch/use-new-ready.ts` (+ prueba) |
| F. Interfaz | `DispatchScreen`/layout con `LiveChannelProvider url="/api/dispatch/stream" invalidate={[['dispatch']]}` y `LiveBadge`. **Cola** (`QueueView`): `ZoneCard` (zona, contador, marca «Sugerida»), `QueueOrderRow` (casilla «Elegir pedido #N», punto y piso, indicación, espera con marca de larga espera), barra `RoundBar` fija abajo con «Salir con la sugerencia» y «Salir con N pedidos» (contador «3 de 5»), motivos de deshabilitado en texto, aviso de pantalla con «Entendido» (D-058). **Rondas** (`RoundsView`): `RoundCard` (zona, salida, llegada estimada, avance, «Vencida hace N min»), `RoundOrderCard` (número, punto/zona/piso, indicación, cliente con `tel:` y WhatsApp, productos resumidos; atenuado y con resultado si ya cerró), `DeliverConfirm` en línea («¿Entregaste el pedido #N? Sí, entregado / Volver») y `FailForm` en línea (motivo obligatorio 1–200 con contador y motivos sugeridos, reutiliza `ReasonField` del 004c). Anuncio `aria-live` de ronda terminada. | `src/components/dispatch/*.tsx` (+ pruebas) |
| G. Rutas y navegación | `/repartidor/cola` y `/repartidor/rondas` bajo un layout de grupo `(despacho)` que abre el canal **una vez** al entrar y lo mantiene al pasar de una a otra (el panel `/repartidor` no abre canal). `NAV.repartidor` habilita «Cola de despacho» y «Mis rondas». | `src/app/(app)/repartidor/(despacho)/layout.tsx`, `cola/page.tsx`, `rondas/page.tsx`, `src/lib/auth/nav.ts` |
| H. Mock y pruebas | El mock gana el módulo de despacho: usuario `repartidor` con nombre y teléfono, `GET /dispatch/queue`, `POST /dispatch/rounds` (sugerencia u `orderIds`; 409 por sin listos, no listos o varias zonas, perfil incompleto y 2 rondas; 404; 400; pasa los pedidos a `en_camino` con repartidor y ETA +15 min), `GET /dispatch/rounds`, `GET /dispatch/rounds/:id`, `POST /dispatch/orders/:id/deliver|fail` (409, 404 de ronda ajena; la ronda se cierra sola), `GET /dispatch/stream` y controles `/__mock/dispatch` (perfil incompleto, ronda ajena). | `tests/mock-api/dispatch.ts`, `server.mts`, `orders.ts` (+ `dispatch.test.ts`), `tests/utils/dispatch.ts`, `e2e/dispatch.spec.ts` |

### Decisiones técnicas del plan

- **Sin tipos a mano:** `RoundResponse`, `QueueResponse` y `OrderResponse` salen de `schema.d.ts`; se reutilizan `Order`, `statusInfo` y `isFinalStatus`.
- **Un solo canal para las dos pantallas:** el proveedor vive en el layout `(despacho)`, así crear una ronda y navegar a «Mis rondas» no reabre la conexión (D-047/D-060).
- **Mover en caché, luego confirmar:** como en cocina, la respuesta del back actualiza la caché y se invalida para que el back confirme; si el canal ya trajo el cambio no se duplica nada.
- **La selección vive en la pantalla de la cola**, no en la caché, y se **depura** cuando un pedido seleccionado deja de estar `listo` (otro repartidor lo tomó): se quita con un aviso, sin perder el resto.
- **«Salir con la sugerencia» no envía pedidos** (deja decidir al back, CA-03); «Salir con N» envía `orderIds` solo con ids de una zona.
- **Estimación vencida es informativa:** se calcula con `etaAt` del back y el reloj de 30 s; no cambia nada en el back.
- **Teléfono:** enlace `tel:` solo si tiene la forma esperada; WhatsApp se arma con los dígitos del E.164 (el back solo entrega `whatsappUrl` del repartidor, no del cliente).
- **Sin `setState` dentro de efectos** (regla del proyecto); acciones con una sola petición (marca síncrona, D-081).

## 2. Dependencias y versiones

Ninguna nueva.

## 3. Estructura de archivos

```
src/
  lib/dispatch/   selection.ts, rounds.ts, contact.ts, errors.ts,
                  use-dispatch-queue.ts, use-active-rounds.ts, use-create-round.ts,
                  use-close-order.ts, use-new-ready.ts (+ pruebas)
  lib/auth/nav.ts                                   # repartidor: Cola y Rondas habilitadas
  components/dispatch/  queue-view.tsx, zone-card.tsx, queue-order-row.tsx, round-bar.tsx,
                        rounds-view.tsx, round-card.tsx, round-order-card.tsx,
                        deliver-confirm.tsx, fail-form.tsx, contact-links.tsx (+ pruebas)
  app/(app)/repartidor/(despacho)/  layout.tsx, cola/page.tsx, rondas/page.tsx
tests/mock-api/  dispatch.ts (+ prueba), orders.ts, server.mts
tests/utils/     dispatch.ts
e2e/             dispatch.spec.ts
docs/            decisions.md (D-084…), commits/005.md
```

## 4. Mapa CA → pruebas

| CA | Prueba |
|---|---|
| CA-01 | `nav.test.ts`; `role-panel.test.tsx`; E2E «guardas»: visitante → login, cliente → su panel, repartidor entra a sus dos rutas. |
| CA-02 | `queue-view.test.tsx`: una tarjeta por zona en el orden del back, «Sugerida», pedidos con número, punto, piso, indicación y espera, sin precios ni pago, vacío. |
| CA-03 | `selection.test.ts` (una zona, tope de 5, motivo de bloqueo); `queue-view.test.tsx` (cuerpo `{}` en la sugerencia y `{ orderIds }` al elegir; las demás zonas deshabilitadas con explicación). |
| CA-04 | `queue-view.test.tsx` (2 rondas activas deshabilita con texto); `errors.test.ts` (perfil incompleto, 2 rondas, no listos, sin listos); aviso de pantalla y refresco. |
| CA-05 | `hooks.test.tsx` (marca síncrona: doble clic = un envío; ambiguo → consulta rondas y decide «salió»/«no salió»); E2E: salir y ver la ronda en «Mis rondas». |
| CA-06 | `round-order-card.test.tsx`: todos los datos, `tel:` y WhatsApp, sin precios ni pago. |
| CA-07 | `round-order-card.test.tsx` y `hooks.test.tsx`: confirmación en línea, `deliver`, `fail` con motivo 1–200, doble clic, atenuado con resultado. E2E: entregar y no entregar con motivo. |
| CA-08 | `errors.test.ts` y `rounds-view.test.tsx`: 409 y 404 con aviso y refresco, red → consulta y «Reintentar», 400 con el mensaje del back. E2E 409 con dos pestañas. |
| CA-09 | `hooks.test.tsx` y `rounds-view.test.tsx`: al cerrar el último pedido la ronda sale y se anuncia «Ronda terminada: N entregados, M no entregados». |
| CA-10 | `rounds.test.ts` (`isOverdue`, minutos) y `round-card.test.tsx` con reloj falso (hora de Bogotá, «Vencida hace N min», refresco a 30 s). |
| CA-11 | `channel.test.tsx` ya cubre el proveedor; `hooks.test.tsx` (sondeo de 15 s solo sin canal); E2E: cocina marca listo y el pedido aparece en la cola en menos de 3 s; indicador «En vivo». |
| CA-12 | `use-new-ready.test.tsx`: la primera carga no avisa, un id nuevo anuncia, con la pestaña oculta suma al título y se limpia al volver; E2E del anuncio. |
| CA-13 | E2E con dos contextos: repartidor sale y el cliente (003b) ve «En camino» con repartidor y llegada; luego «Entregado» / «No entregado» con motivo. |
| CA-14 | Pruebas de componente con roles y nombres con el número; E2E en 360 px: sin desborde y botones ≥ 48 px. |
| CA-15 | `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `npm audit`, E2E completo. |
| CA-16 | El conjunto anterior. |

## 5. Orden de implementación (cada paso termina en verde: `tsc`, `eslint`, `prettier`, pruebas)

1. Mock de despacho (`dispatch.ts`, rutas, canal, usuario `repartidor`) con pruebas del almacén; comprobar cómo el E2E inicia sesión como repartidor (`login`).
2. Lógica pura: `selection`, `rounds`, `contact`, `errors` con pruebas.
3. Datos: cola, rondas activas, crear ronda, cerrar pedido, avisos de pedido listo, con pruebas de hooks.
4. Interfaz de la cola: tarjetas, selección, barra de salir, avisos; pruebas de componente.
5. Interfaz de rondas: tarjetas, pedido, confirmar entrega, no entregado, ronda terminada; pruebas de componente.
6. Rutas, layout con canal y navegación; pruebas de navegación.
7. E2E `dispatch.spec.ts` (escritorio y 360 px) y revisión visual con capturas.
8. Verificación completa, `tasks.md` y `docs/commits/005.md`; parar para tu revisión.

## 6. Riesgos técnicos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| El E2E en paralelo (escritorio y 360 px) comparte el mock y la cola de despacho es global | Cada proyecto crea **sus** pedidos y los lleva a `listo` con el mock; las pruebas usan zonas distintas por proyecto y filtran por número; el estado del repartidor del mock (2 rondas) se reinicia con un control antes de cada prueba. |
| El texto exacto de los 409 de «crear ronda» no está en el contrato | **Validado leyendo el código del back (`src/dispatch/dispatch.service.ts`, §Anexo A):** los textos son fijos y distintos entre sí; se clasifica por palabras clave de esos textos y, si no coincide ninguna, se muestra el mensaje del back tal cual. Lo que el código no puede probar (ejecución real) queda en la verificación manual. |
| Un pedido seleccionado lo toma otro repartidor | 409 con aviso, cola refrescada y selección depurada; el back es la fuente de verdad. |
| Crear ronda con corte de red (no idempotente) | Sin reintento; se consulta antes de permitir repetir (D-070); máximo 2 rondas activas limita el daño de un duplicado. |
| El repartidor en la calle con señal intermitente | Indicador «En vivo / Reconectando…», sondeo de respaldo, mensajes claros y botones que no se pierden al refrescar. |
| Perfil incompleto del repartidor | Frase propia y el aviso lleva a pedir ayuda al admin; se prueba en el mock con `/__mock/dispatch`. |
| Teléfono con formato inesperado | `tel:` solo si tiene la forma esperada; si no, texto plano. |
| Cambiar el layout del repartidor rompe el panel o la navegación | El grupo `(despacho)` es aparte; `/repartidor` no cambia salvo quitar «Próximamente» de las dos entradas. |

## 7. Fuera de plan

Rondas para operador y admin (007), historial de rondas finalizadas y métricas (008), mapa o GPS, tratamiento de pedidos `no_entregado`, sonidos y notificaciones.

## Anexo A — Errores del back verificados en su código (2026-11-10)

Lectura de `Mocca-Go/src/dispatch/dispatch.service.ts` y `dispatch.dto.ts` (sin tocar `.env`). El mock imitará estos textos exactos.

| Operación | Código | Mensaje del back | Clasificación en el front |
|---|---|---|---|
| `POST /dispatch/rounds` | 409 | `Tu perfil de repartidor no tiene el nombre completo ni el teléfono; pídele al administrador que lo complete.` (varía: «el nombre completo» / «el teléfono») | `profile` (palabra clave «perfil de repartidor») |
| | 409 | `Ya tienes 2 rondas activas; termina una antes de salir con otra.` | `rounds-limit` («rondas activas») |
| | 409 | `No hay pedidos listos para despachar.` | `no-ready` |
| | 409 | `Los pedidos #1042, #1043 ya no están en estado «listo».` | `taken` («ya no están en estado») |
| | 409 | `Una ronda es de una sola zona; elegiste pedidos de: Zona 1, Zona 2.` | `zones` («una sola zona») |
| | 404 | `Pedido no encontrado: <uuid>, …` (solo si el pedido **no existe**) | `missing` |
| | 400 | `orderIds`: 1–5, únicos y UUID v4 | `validation` |
| `POST /dispatch/orders/{id}/deliver` y `/fail` | 409 | `El pedido #N está en estado «X»; solo uno «en_camino» se puede cerrar.` | `conflict` |
| | 404 | `Pedido no encontrado.` (no existe, no tiene ronda o es de la ronda de otro repartidor) | `missing` |
| | 400 | `reason`: 1–200 con al menos un carácter visible, sin NUL; el back lo recorta | `validation` (el front también recorta) |
| `GET /dispatch/rounds/{id}` | 404 | `Ronda no encontrada.` | `missing` |
| Cualquiera | 401 | `Credenciales inválidas.` (p. ej. el repartidor fue borrado) | cierra sesión (pasarela) |

**Hallazgos que cambian el diseño (P-07 resuelto):**
1. **Un pedido tomado por otro repartidor responde 409, no 404** (`ya no están en estado «listo»`): el pedido existe pero ya está `en_camino`. La selección se depura y se avisa con el número del pedido.
2. **«Salir con la sugerencia» usa `skip_locked`:** si otro repartidor está creando su ronda en el mismo instante, sus pedidos se saltan y esta ronda puede salir con menos pedidos, o responder `No hay pedidos listos` aunque la cola aún los muestre. El mensaje al repartidor es «Otro repartidor acaba de tomar esos pedidos; se actualizó la cola», no un error propio.
3. El back **no puede dejar** un pedido en dos rondas ni pasarse de 5 o de 2 rondas: los topes del front (`MAX_ROUND_ORDERS`, `MAX_ACTIVE_ROUNDS`) son comodidad, no seguridad.
4. `whatsappUrl` del back es `https://wa.me/<E.164 sin «+»>`: el front arma el del cliente igual.
5. Al cerrar el último pedido el back finaliza la ronda en la misma transacción: la respuesta de `deliver`/`fail` ya es consistente con `GET /rounds`.
