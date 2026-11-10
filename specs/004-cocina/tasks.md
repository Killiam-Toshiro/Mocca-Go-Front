# Tareas 004 — Cocina (operador y admin)

Plan: `plan.md` (aprobado el 2026-11-10).

- [x] T-01 Mock: cola de cocina, `start`/`ready`, cancelación de personal con motivo (409/404/400), canal `/kitchen/stream` — CA-02, CA-04, CA-05, CA-06, CA-07
- [x] T-02 Canal en vivo genérico (`src/lib/live/channel.tsx`) y reutilización en pedidos del cliente (003b sigue verde) — CA-07
- [x] T-03 Lógica de tablero (`board.ts`): espera, umbrales 5/15/10 min, «Listos» compacto, `tel:` — CA-02, CA-03, CA-09
- [x] T-04 Errores de cocina (`errors.ts`) y hooks (cola, acción, cancelar, reloj de 30 s, pedidos nuevos y contador del título) — CA-04, CA-05, CA-06, CA-08
- [x] T-05 Interfaz: tarjeta, tarjeta compacta, columna, cancelar con motivo, vista y pantalla — CA-02, CA-03, CA-04, CA-06, CA-11
- [x] T-06 Rutas `/operador/cocina` y `/admin/cocina` y navegación de ambos roles — CA-01
- [x] T-07 Pruebas unitarias y de componente (`board`, `errors`, `hooks`, `use-new-orders`, `kitchen-view`, `channel`) — CA-13
- [x] T-08 E2E `kitchen.spec.ts` (escritorio y móvil 360 px) — CA-01, CA-04, CA-05, CA-06, CA-07, CA-10, CA-11
- [x] T-09 Verificación completa y `docs/commits/004.md` — CA-12, CA-13
- [ ] T-10 Verificación manual contra el back real (spec §8, la haces tú)

## Desviaciones respecto al plan
- En pantallas estrechas el cambio de columna son botones agrupados (`role="group"`, `aria-pressed`) y no un `tablist`: la columna visible no es un panel de pestañas con teclado de flechas, y así se evita prometer una interacción que no existe.
- `useKitchenAction` y `useKitchenCancel` reciben `onDone` y `onFail` a nivel de hook: `mutate(…, {onSuccess})` no se ejecuta si la tarjeta ya se desmontó al moverse de columna.
- Un doble clic enviaba dos peticiones (`isPending` se actualiza con retraso): la tarjeta y el formulario de cancelar usan una marca síncrona (`useRef`).
- **Hallazgo del E2E:** el aviso de 409/404 vivía dentro de la tarjeta y desaparecía cuando el refresco la movía de columna. Ahora es un aviso de pantalla («Pedido #N: Otro operador ya cambió este pedido.», con «Entendido»); los errores de red/5xx siguen en la tarjeta con «Reintentar».
- El canal en vivo se extrajo a un proveedor genérico (`LiveChannelProvider`); el de pedidos del cliente es ahora un envoltorio delgado.
- En el E2E de 360 px hay que elegir la columna antes de mirarla (solo se ve una a la vez).
