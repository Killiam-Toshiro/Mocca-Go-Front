# Tareas 003b — Seguimiento en vivo (SSE)

Plan: `plan.md` (aprobado el 2026-11-10).

- [x] T-01 Analizador SSE (`parser.ts`) y espera de reconexión (`backoff.ts`) con pruebas — CA-11, CA-05
- [x] T-02 Cliente SSE (`client.ts`): reconexión, 401/403/429, vigilante de 60 s, `close()` — CA-05, CA-06, CA-07, CA-10
- [x] T-03 Mock: canal real (`ready`, `order`, latidos), `onChange` del almacén y controles; `forward.test.ts` usa el modo `legacy`
- [x] T-04 Proveedor `OrdersLiveProvider` en el layout del cliente: un canal por pestaña, pestaña oculta 45 s, invalidación por evento — CA-01, CA-08, CA-09
- [x] T-05 Anuncios `aria-live` y `LiveBadge` — CA-03, CA-04
- [x] T-06 Respaldo: sondeo de 15 s solo si el canal no está conectado (detalle y lista) — CA-05, CA-06
- [x] T-07 E2E `live.spec.ts` (escritorio y móvil 360 px) y ajuste de `orders.spec.ts`
- [x] T-08 Verificación completa y `docs/commits/003b.md` — CA-13
- [ ] T-09 Verificación manual contra el back real (spec §8, incluye P-05)

## Desviaciones respecto al plan
- Las pruebas E2E de fallos del canal (corte, 403, 429, 401) usan `page.route` en el navegador en lugar de los controles globales del mock (`/__mock/stream/*`): los proyectos de escritorio y móvil corren en paralelo y comparten el mock, y un control global afectaría a las otras pruebas. Los controles quedan disponibles para uso manual.
- El texto «Conectando…» (estado `connecting`) se agregó al indicador; el spec solo nombraba «En vivo» y «Reconectando…».
- El pedido terminado ya no muestra el indicador (no hay nada que seguir).
- Si el pedido cambia de estado mientras el cliente confirma «Cancelar pedido», con el canal en vivo la confirmación desaparece sola (ya no se puede cancelar); el aviso del 409 solo se ve cuando el canal no está activo (`orders.spec.ts` lo prueba con el canal rechazado).
