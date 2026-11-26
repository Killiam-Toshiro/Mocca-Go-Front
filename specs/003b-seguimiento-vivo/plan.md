# Plan 003b — Seguimiento en vivo (SSE)

**Spec:** `specs/003b-seguimiento-vivo/spec.md` (aprobada el 2026-11-10) · **Estado del plan:** borrador, pendiente de tu aprobación

Vocabulario: **canal** = la conexión SSE abierta a `/api/orders/stream`. **Respaldo** = el sondeo de 15 s del 003. **Estado del canal** = `off` (sin proveedor), `connecting`, `live`, `reconnecting`, `stopped` (sin reintentos: 403).

## 1. Enfoque técnico

| Bloque | Qué se construye | Archivos clave |
|---|---|---|
| A. Analizador SSE | `createSseParser(onEvent)`: recibe texto por partes y emite `{event, data}`. Soporta `\n`, `\r\n`, `\r`, comentarios (`:`), varios `data:` (unidos con `\n`), `event:` ausente (= `message`), bloques partidos entre lecturas y un último bloque sin línea en blanco (se descarta, como indica el estándar). | `src/lib/sse/parser.ts` |
| B. Espera de reconexión | `nextDelay(attempt, random)`: 1 s, 2 s, 4 s… tope 30 s, con variación ±20 %. Función pura. | `src/lib/sse/backoff.ts` |
| C. Cliente SSE | `openSseChannel({ url, onEvent, onState, onUnauthorized, fetch?, timers? })` devuelve `{ close }`. Bucle: `fetch` (`cache: 'no-store'`, `accept: text/event-stream`, `AbortController`) → si no es 200 decide por código (401 → `onUnauthorized` y fin; 403 → `stopped`; 429 → espera 60 s; otro → espera creciente) → lee con `TextDecoder` en modo flujo → vigilante de 60 s que se reinicia con cada trozo → al terminar el flujo o fallar, reconecta. `ready` reinicia la espera y marca `live`. `close()` aborta todo y deja de reconectar. `fetch` y temporizadores inyectables para probar sin esperar. | `src/lib/sse/client.ts` |
| D. Proveedor en vivo | `OrdersLiveProvider` (cliente), montado en `cliente/layout.tsx`: abre el canal con la pestaña visible; `visibilitychange` oculta → temporizador de 45 s que cierra; visible → cancela y reabre; `ready` y `order` → `invalidateQueries` de `['orders']` y `['order']`; 401 → `notifyUnauthorized()`; al desmontar cierra. Expone `useLiveStatus()` (por defecto `off` sin proveedor, así las pruebas del 003 no cambian). | `src/lib/orders/live.tsx` |
| E. Anuncios | El proveedor suscribe la caché de consultas: guarda `id → estado` de cada pedido visto y, cuando un pedido ya conocido cambia, anuncia «Pedido #N: <estado>» en una región `role="status"` (`aria-live="polite"`, solo lectores de pantalla). La primera vez que se ve un pedido no se anuncia. **No usa el dato del evento**, así que no depende de P-05. | `src/lib/orders/live.tsx`, `src/components/orders/live-announcer.tsx` |
| F. Indicador | `LiveBadge`: «En vivo» (ícono de señal) / «Reconectando…» (ícono girando suave, respeta `prefers-reduced-motion`) / nada en `off` y `stopped` (con `stopped` un texto «Actualización automática cada 15 s»). Va en el encabezado del detalle y de «Mis pedidos». | `src/components/orders/live-badge.tsx` |
| G. Respaldo | `orderRefetchInterval(order, live)`: sondeo de 15 s si el estado no es final **y el canal no está `live`**. La lista: `refetchInterval` de 15 s solo si el canal está `reconnecting` o `stopped` y hay algún pedido no final. | `src/lib/orders/use-order.ts`, `use-orders.ts` |
| H. Mock | `GET /orders/stream` pasa a ser un canal real por usuario: `ready` al abrir, `event: order` + `data` JSON `{number, status, at}` cuando cambia un pedido del usuario (crear, cancelar, avanzar), comentario de latido cada `heartbeatMs` (configurable). Controles: `POST /__mock/stream/drop` (cierra todos los canales), `POST /__mock/stream/behavior` (`{status: 401\|403\|429\|null, silent: bool, heartbeatMs}`), `GET /__mock/stream/count`. El almacén de pedidos avisa los cambios con un `onChange`. Antes de reemplazar el flujo de prueba de 3 fragmentos se revisa quién lo usa (`forward.test.ts` tiene su propio mock). | `tests/mock-api/orders.ts`, `server.mts` |

### Decisiones técnicas del plan

- **Sin dependencias nuevas.** El analizador y el cliente son propios (D-047).
- **El contenido del evento no se confía.** Se ignora; solo cuenta que llegó (D-049). Por eso un evento mal formado no rompe nada (CA-10) y no se pinta nunca como HTML.
- **Un solo canal por pestaña:** el proveedor vive en el layout, que no se desmonta al navegar entre lista y detalle. En desarrollo, React monta dos veces: el primer canal se cierra al instante (`close()` aborta el `fetch`).
- **La caída se detecta por tres vías:** `fetch` que falla, flujo que termina y silencio de 60 s. Las tres terminan en el mismo bucle de reconexión.
- **401:** se usa el mismo camino que el resto de la app (`notifyUnauthorized`), que limpia la caché y pasa por `/api/auth/expired`; el canal queda cerrado.
- **Cierre de sesión:** el cierre de sesión navega a otra página y desmonta el proveedor; además el cliente es cerrado en el `useEffect` de limpieza.
- **Pestaña oculta:** el cierre a los 45 s y la reapertura se prueban con temporizadores falsos (`vi.useFakeTimers`) y un `document.visibilityState` simulado; en el E2E no se simula (Playwright no oculta la pestaña de forma fiable).

## 2. Dependencias y versiones

Ninguna nueva. Se usan `@tanstack/react-query` 5.107.1 (`invalidateQueries`, suscripción a la caché), `lucide-react` 1.70.0 (íconos) y las herramientas de prueba existentes.

## 3. Estructura de archivos

```
src/
  lib/
    sse/       parser.ts, backoff.ts, client.ts (+ pruebas)
    orders/    live.tsx (proveedor, useLiveStatus, anuncios), use-order.ts y use-orders.ts (respaldo)
  components/
    orders/    live-badge.tsx, live-announcer.tsx; order-detail-view.tsx y orders-view.tsx (indicador)
  app/(app)/cliente/layout.tsx   # envuelve con OrdersLiveProvider
tests/mock-api/  orders.ts (onChange), server.mts (canal real + controles)
e2e/             live.spec.ts
docs/            decisions.md (D-047…D-054, P-05), commits/003b.md
```

## 4. Mapa CA → pruebas

| CA | Prueba |
|---|---|
| CA-01 | E2E `live.spec.ts`: con el detalle abierto, `POST /__mock/orders/:id/status` y el estado cambia en menos de 3 s **sin recargar** (con sondeo de 15 s, fallaría). Unitaria del proveedor: un `order` invalida la consulta. |
| CA-02 | E2E: «Mis pedidos» abierto, un pedido avanza de estado y otro nuevo creado por API aparece arriba. |
| CA-03 | `live.test.tsx`: cambio de estado de un pedido conocido → el texto «Pedido #N: En camino» aparece en el `role="status"`; sin cambio o primera vez → no se anuncia. |
| CA-04 | `live-badge.test.tsx` por estado (texto + ícono); E2E: «En vivo» tras cargar. |
| CA-05 | `client.test.ts`: espera creciente (1, 2, 4… 30 s) con relojes falsos y `random` fijo; `ready` reinicia. E2E: `drop` → «Reconectando…» → «En vivo»; y `hooks.test.tsx`: sondeo de 15 s solo cuando el canal no está `live`. |
| CA-06 | `client.test.ts`: 401 llama a `onUnauthorized` sin reintentar; 403 → `stopped` sin reintentar; 429 → espera 60 s. E2E: 429 del canal → el detalle sigue actualizándose por el respaldo. |
| CA-07 | `client.test.ts`: 60 s sin trozos (relojes falsos) → aborta y reabre; un latido a los 25 s lo mantiene. |
| CA-08 | `live.test.tsx`: oculta 44 s → abierto; 45 s → cerrado; al volver → abre y consulta. |
| CA-09 | `live.test.tsx`: navegar entre lista y detalle no abre otro canal (una sola llamada a `fetch`); al desmontar se aborta. E2E: `GET /__mock/stream/count` = 1 tras navegar lista → detalle → lista. |
| CA-10 | `client.test.ts` / `live.test.tsx`: `data` con basura, evento desconocido y JSON roto no lanzan error y solo provocan consulta. |
| CA-11 | `parser.test.ts`: tabla de casos (`\n`, `\r\n`, `\r`, comentarios, varios `data`, partido byte a byte, sin `event`, campo sin valor, espacio tras `:`). |
| CA-12 | Ya cubierto por `forward.test.ts` (trozos sin buffer, corte al desconectar) + E2E contra el mock real. |
| CA-13 | `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `npm audit`, E2E completo. |

## 5. Orden de implementación (cada paso termina en verde: `tsc`, `eslint`, `prettier`, pruebas)

1. Analizador (`parser.ts`) y espera (`backoff.ts`) con sus pruebas.
2. Cliente SSE (`client.ts`) con pruebas y relojes falsos.
3. Mock: canal real, `onChange` del almacén y controles, con pruebas del almacén.
4. Proveedor en vivo (`live.tsx`), anuncios e indicador; cableado en `cliente/layout.tsx`.
5. Respaldo en `use-order.ts` / `use-orders.ts` y pruebas de los hooks.
6. Indicador en el detalle y en «Mis pedidos»; pruebas de componente.
7. E2E `live.spec.ts` (escritorio y móvil) y revisión visual con captura.
8. Verificación completa, `tasks.md` y `docs/commits/003b.md`; parar para tu revisión.

## 6. Riesgos técnicos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Forma del evento `order` no documentada (P-05) | No se usa su contenido (D-049); se confirma en la prueba manual y, si trae el `id`, se podrá invalidar solo ese pedido (mejora opcional). |
| Un proxy o Railway cortan el flujo | Reconexión automática + respaldo; `x-accel-buffering: no` ya está; se verifica el límite al desplegar (P-02). |
| Canal «muerto» tras suspender el equipo | Vigilante de 60 s (D-051) y recarga de datos al volver a la pestaña. |
| Muchas pestañas agotan los 5 canales | 429 → espera de 60 s y respaldo; el indicador lo dice; la pestaña oculta libera su canal (D-048). |
| Tormenta de consultas si llegan muchos eventos seguidos | `invalidateQueries` deduplica las consultas en curso; solo se recargan las consultas activas (las que se están viendo). |
| Dos aperturas por el doble montaje de React en desarrollo | El primer canal se aborta al desmontar; prueba de que no quedan dos abiertos. |
| El mock no se comporta como el back | Mismo protocolo (`ready`, `order`, latidos) y verificación manual contra el back real (spec §8). |

## 7. Fuera de plan

Canales de cocina y despacho (004 y 005, reutilizarán `sse/client.ts`); notificaciones del navegador; recuperar eventos perdidos; encuesta del cliente (006).
