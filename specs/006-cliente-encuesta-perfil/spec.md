# Spec 006 — Cliente: encuesta y perfil

**Repo:** `mocca-go-front` · **Fecha:** 2026-11-11 · **Estado:** aprobada el 2026-11-11 (v1.1: DP-04 reducida —solo la tarjeta del detalle, sin marcas en «Mis pedidos»—; contraseña sin cerrar la sesión actual; las DP pasan a D-095 en adelante)
**Contrato consumido:** `docs/openapi.json` (módulos `orders` → `survey`, `customers`, `auth` → `password`) y `docs/frontend-handoff.md` §3, §6 · **Siguiente paso tras aprobar:** `plan.md` → `tasks.md`

---

## 1. Objetivo

Que el **cliente** cierre el ciclo de su pedido calificándolo cuando llega («¿Qué tal estuvo?», de 1 a 5 y un comentario opcional) y que tenga una pantalla **«Mi perfil»** donde ve sus datos, corrige su nombre y celular y cambia su contraseña. Hoy «Mi perfil» aparece en el menú como «Próximamente» y el detalle del pedido entregado no pide ninguna calificación.

## 2. Decisiones ya tomadas

| ID | Decisión | Origen |
|---|---|---|
| D-012 | Cada rol solo visita su prefijo; el cliente solo `/cliente`. | Spec 001 |
| D-014 / D-016 | El navegador solo habla con `/api/...`; la pasarela agrega el `Bearer` y solo deja pasar rutas del contrato (`/customers/me`, `/orders/{id}/survey` y `/auth/password` ya están en la tabla). | Spec 001 |
| D-046 | Estados con texto + ícono, nunca solo color. | Spec 003 |
| D-047 a D-054 | Seguimiento en vivo del pedido: un evento = volver a consultar el pedido. El paso a «Entregado» ya llega solo a la pantalla. | Spec 003b |
| D-058 | 409/404 de una acción se explican en un aviso de pantalla («Entendido») y se refresca el estado. | Spec 004 |
| D-070 | Una petición no idempotente no se reintenta sola; tras un corte de red se revisa el estado antes de repetir. | Spec 004b |
| — | `useDisplayName` ya lee `GET /customers/me` con la clave `['customers','me']` para mostrar el nombre en la cabecera. | Spec 001 |

## 3. Alcance

**Entra**
- **Encuesta:** formulario en el detalle del pedido cuando `status === 'entregado'` y `survey === null`; el pedido ya calificado muestra la respuesta de solo lectura.
- **Mi perfil** (`/cliente/perfil`), habilitado en la navegación: ver correo, nombre, celular y fecha de alta; editar nombre y celular (`PATCH /customers/me`); cambiar contraseña (`PATCH /auth/password`).
- Mock de la API ampliado (`POST /orders/:id/survey`, `PATCH /customers/me`, `PATCH /auth/password`) y pruebas (unitarias, de componente y E2E).

**No entra**
- Ver o editar la encuesta una vez enviada (el back no lo permite) y ver las encuestas de otros (admin: incremento 008; operador: con el listado de pedidos, 007).
- Cambiar el correo (el back no lo permite), eliminar la cuenta o recuperar la contraseña olvidada (no hay endpoints).
- Calificar un pedido `no_entregado` o `cancelado` (el back solo acepta `entregado`).
- Distintivos o resúmenes de «por calificar» en «Mis pedidos» (decisión del usuario: solo la tarjeta del detalle).
- Recordatorios por correo o notificaciones del navegador.

## 4. Contrato consumido

| Operación | Cuerpo / respuesta relevante | Errores a manejar |
|---|---|---|
| `POST /orders/{id}/survey` | `{ rating: 1..5 (entero), comment?: 1..300 }` (el comentario se recorta; si se envía no puede quedar vacío ni llevar NUL). 201 → `{ orderId, rating, comment \| null, createdAt }`. Solo el cliente dueño, pedido `entregado`, **una sola vez, no se edita**. | **404** `Pedido no encontrado.` (no existe o es de otro) · **409** `El pedido #N está en estado «X»; la encuesta se responde cuando está «entregado».` · **409** `Este pedido ya tiene una respuesta de la encuesta.` · 400 validación. Los textos salen del código del back. |
| `GET /orders/{id}` y `GET /orders` | Cada pedido trae `survey: { rating, comment, createdAt } \| null`. | — |
| `GET /customers/me` | `{ id, email, fullName, phone (E.164), createdAt, updatedAt }`. | 404 `CUSTOMER_NOT_FOUND`. |
| `PATCH /customers/me` | `{ fullName?: 2..100 (recortado), phone? }`. Con ningún campo → 400 `Indica al menos un campo para editar.` Ningún campo admite `null`. El celular se normaliza a E.164 (`+573001234567`); uno no interpretable → 400 `phone debe ser un celular colombiano o un número internacional válido.` Si no cambia nada, responde igual y no toca `updatedAt`. | 400 · 404 |
| `PATCH /auth/password` | `{ currentPassword, newPassword }`, ambas 12..128; la nueva debe ser **distinta**. 204. **Revoca las demás sesiones**; la actual sigue válida. Comparte el contador de fallos del login: **cinco fallos bloquean la cuenta 15 minutos**. | **403** contraseña actual incorrecta o cuenta bloqueada · 400 igual a la actual o inválida · 401 sesión · 429 (20 por minuto por IP) |

**Hallazgos al cruzar el handoff con el OpenAPI y el código del back**
1. El **403 de `/auth/password` es «contraseña actual incorrecta»**, no «sin permiso de rol». Revisado en el plan: la pasarela lo deja pasar tal cual y `requestJson` solo actúa con el 401; se cubre con prueba y se muestra como error del campo.
2. La encuesta **no se puede editar ni borrar**: el formulario necesita una confirmación implícita clara («Al enviar no podrás cambiarla»).
3. El pedido entregado por el repartidor llega al cliente por el canal en vivo del 003b: la encuesta debe **aparecer sola** si el cliente tiene el detalle abierto.

## 5. Decisiones de diseño propuestas (requieren tu visto bueno)

| ID | Propuesta | Alternativa |
|---|---|---|
| DP-01 | **La encuesta vive en el detalle del pedido** (`/cliente/pedidos/[id]`), en una tarjeta «¿Qué tal estuvo tu pedido?» entre la entrega y el pago, solo con `entregado` + `survey === null`. Una vez enviada la tarjeta pasa a «Tu calificación» (estrellas con texto «5 de 5 · Excelente» y el comentario) sin recargar. | Ventana emergente al abrir el pedido entregado (interrumpe y es más difícil de hacer accesible). |
| DP-02 | **Calificación con 5 opciones accesibles:** grupo de botones de opción (radio) con estrellas grandes (≥ 48 px) y etiqueta de texto bajo la seleccionada (1 Muy mala · 2 Mala · 3 Regular · 4 Buena · 5 Excelente); nunca solo color ni solo ícono; manejable con flechas del teclado. **Obligatoria**; el comentario es opcional, de hasta 300 con contador, y «Enviar calificación» queda deshabilitado hasta elegir una. Aviso fijo: «Al enviarla no podrás cambiarla». | Emojis; o enviar en un solo toque al elegir la estrella (sin comentario y sin deshacer). |
| DP-03 | **Aviso al llegar:** si el pedido pasa a «Entregado» con el detalle abierto, un anuncio `aria-live` («Tu pedido #N fue entregado. ¡Cuéntanos qué tal estuvo!») y la tarjeta aparece sin mover el foco del usuario; la tarjeta es visible dentro del detalle sin desplazamiento forzado. | Foco automático en la tarjeta (arrebata el foco). |
| DP-04 | **Sin marcas en «Mis pedidos»** (decisión del usuario): la calificación solo se pide y se ve en el detalle del pedido. | Distintivo «Califícalo» y resumen de pendientes en la lista. |
| DP-05 | **Errores de la encuesta:** **409 «ya tiene respuesta»** (p. ej. se envió desde otra pestaña) → aviso «Este pedido ya tenía tu calificación» y se muestra la guardada; **409 de estado** y **404** → aviso de pantalla («Entendido») y se refresca. Un **corte de red** no reintenta solo (no es idempotente): se vuelve a consultar el pedido para saber si quedó guardada; si sí, se muestra; si no, se conserva lo escrito y se ofrece «Reintentar». El botón evita el doble clic con marca síncrona. | Reintento automático. |
| DP-06 | **Mi perfil — una pantalla, tres bloques:** (1) **Mis datos**: correo (solo lectura, con la nota «El correo no se puede cambiar») y «Cliente desde {fecha}»; (2) **Editar** nombre y celular con un solo «Guardar cambios», que solo se habilita si algo cambió y envía **solo los campos modificados**; (3) **Cambiar contraseña** en su propio formulario. | Un formulario para todo; o una pantalla por bloque. |
| DP-07 | **Celular:** se escribe como la persona quiera (`300 123 4567`, `+57…`); el front valida solo una forma razonable (igual que el registro) y el back decide; al guardar se muestra el valor E.164 que devolvió el back y la cabecera se actualiza (`['customers','me']`). Errores 400 del back como mensaje del campo. | Máscara que reescribe mientras se escribe. |
| DP-08 | **Contraseña:** campos «Contraseña actual», «Contraseña nueva» (12–128, con el botón de mostrar de siempre) y «Repite la nueva»; el front valida que la nueva sea distinta de la actual y que las dos coincidan antes de enviar. Tras el 204: aviso «Cambiamos tu contraseña. Cerramos tus otras sesiones»; se vacía el formulario y la sesión actual sigue. **403** → «La contraseña actual no es correcta» en el campo (el back da **el mismo 403 y el mismo texto** para contraseña errada y cuenta bloqueada, así que no se pueden distinguir); como ayuda fija bajo el campo: «Si fallas varias veces, la cuenta se bloquea 15 minutos»; 429 con su mensaje. | Cerrar también la sesión actual. |
| DP-09 | **Guardar sin doble clic y sin reintento automático** (marca síncrona). `PATCH /customers/me` es idempotente, pero tras un corte de red se muestra «No pudimos confirmar el cambio» con «Reintentar» y se vuelve a consultar el perfil; no se pisa lo que la persona escribió. | Reintento automático de la edición. |
| DP-10 | **Cargando / error del perfil:** esqueleto mientras llega; si falla la consulta, mensaje con «Reintentar» y los formularios no se muestran vacíos. Al salir con cambios sin guardar **no** se pregunta (no se pierde nada importante). | Aviso de «cambios sin guardar». |
| DP-11 | **Diseño móvil primero (360 px):** tarjetas apiladas, estrellas y botones ≥ 48 px, sin desborde horizontal, solo tokens de color, contraste AA. | — |

## 6. Rutas y comportamiento

| Ruta | Quién | Qué muestra |
|---|---|---|
| `/cliente/pedidos/[id]` (existente) | Cliente | + tarjeta de encuesta / «Tu calificación». |
| `/cliente/perfil` | Cliente | Mis datos, editar, cambiar contraseña. |

**Reglas**
- La tarjeta de encuesta depende solo de `status` y `survey` del pedido (la verdad la tiene el back); al enviar se actualiza la caché del pedido y de la lista con la respuesta, sin recargar.
- Comentario: se recorta; si queda vacío no se envía (es opcional, no vacío); máximo 300; el texto se envía y muestra siempre como texto.
- Fechas en America/Bogota («Cliente desde 3 de noviembre de 2026»).
- **Seguridad:** el correo y el celular solo se ven aquí y en la cabecera de la sesión propia; las contraseñas nunca se guardan fuera del formulario, se vacían tras el envío y no viajan en la URL ni en los registros; los campos usan `autocomplete` correcto (`current-password` / `new-password`).
- El cambio de contraseña **no** cierra la sesión actual (lo dice el back); las demás sesiones del cliente sí caen y el aviso lo explica.

## 7. Criterios de aceptación

| ID | Criterio (verificable) |
|---|---|
| CA-01 | `/cliente/perfil` solo lo ve el cliente (visitante → login; otros roles → su panel); «Mi perfil» queda habilitado en la navegación. |
| CA-02 | El detalle de un pedido `entregado` con `survey: null` muestra «¿Qué tal estuvo tu pedido?»; con otro estado o con `survey` no lo muestra; con `survey` muestra «Tu calificación» de solo lectura (estrellas + texto + comentario). |
| CA-03 | La calificación es un grupo de 5 opciones accesible (nombre por opción, flechas, ≥ 48 px, texto de la etiqueta); «Enviar calificación» está deshabilitado sin elegir; el comentario recorta, cuenta hasta 300 y no se envía vacío; el aviso «no podrás cambiarla» está visible. |
| CA-04 | Enviar hace un solo `POST /orders/{id}/survey` con `{ rating }` o `{ rating, comment }`; doble clic = un envío; al terminar la tarjeta pasa a «Tu calificación» y el foco queda en un lugar con sentido. |
| CA-05 | Errores de encuesta: 409 «ya tiene respuesta» → muestra la guardada con aviso; 409 de estado y 404 → aviso «Entendido» y refresco; 400 → mensaje del back; corte de red → no reintenta solo, consulta el pedido, muestra la respuesta si quedó guardada o conserva lo escrito con «Reintentar». |
| CA-06 | Con el detalle abierto, cuando el pedido pasa a `entregado` (canal en vivo o sondeo) aparece la tarjeta y se anuncia por `aria-live` sin mover el foco. |
| CA-07 | «Mis pedidos» **no cambia** (sin distintivos ni resumen); al calificar se actualiza la caché del pedido y de la lista con la respuesta. |
| CA-08 | «Mi perfil» muestra correo (solo lectura, con su nota), nombre, celular y fecha de alta desde `GET /customers/me`; esqueleto al cargar y mensaje con «Reintentar» si falla. |
| CA-09 | «Guardar cambios» se habilita solo si nombre o celular cambió, envía **solo** los campos modificados, valida nombre 2–100 y celular razonable en el front, y pinta los 400 del back en el campo; al guardar muestra el valor devuelto (E.164), anuncia «Guardamos tus cambios» y actualiza el nombre de la cabecera. |
| CA-10 | Cambiar contraseña: valida 12–128, que la nueva sea distinta de la actual y que se repita igual; envía `{ currentPassword, newPassword }`; en 204 vacía el formulario, anuncia el éxito y la sesión sigue activa. |
| CA-11 | Errores de contraseña: 403 se muestra como «La contraseña actual no es correcta» en el campo, con la ayuda fija sobre el bloqueo de 15 minutos, **sin** tratarlo como falta de permiso ni cerrar la sesión; 429 y 400 con su texto; los campos de contraseña no conservan valores tras un error de red ni tras el éxito. |
| CA-12 | Guardar perfil y cambiar contraseña: sin doble clic y sin reintento automático. Tras un corte de red, el perfil consulta su estado antes de ofrecer «Reintentar»; la contraseña no tiene estado que consultar, así que el aviso dice que quizá ya se cambió («si la actual ya no te sirve, prueba con la nueva») y conserva lo escrito en los campos que no son contraseña. |
| CA-13 | Accesibilidad: etiquetas visibles y asociadas, errores con `aria-describedby`, `aria-live` en los avisos, foco gestionado tras cada acción, estados con texto + ícono, contraste AA. |
| CA-14 | Diseño: 360 px sin desborde horizontal; botones y estrellas ≥ 48 px; solo tokens de color. |
| CA-15 | `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `audit` y `e2e` en verde. |
| CA-16 | Pruebas: unitarias (validación de comentario/calificación, mapeo de errores de encuesta y de contraseña, diferencias del perfil), de componente (encuesta, lista, perfil, contraseña) y E2E contra el mock (calificar, 409 de doble envío, aparición en vivo, editar perfil, cambiar contraseña con 403, corte de red, 360 px). |

## 8. Verificación contra el back real

Con el back local, el seed y un cliente registrado:
1. Hacer un pedido y llevarlo a «Entregado» (cocina + repartidor). Con el detalle abierto, la tarjeta de encuesta aparece sola; calificar 4 con comentario: pasa a «Tu calificación».
2. Recargar y volver desde «Mis pedidos» al detalle: sigue calificado. Un segundo pedido entregado sin calificar muestra la tarjeta de encuesta.
3. Calificar el mismo pedido desde dos pestañas: la segunda recibe el 409 y muestra la ya guardada.
4. Como admin (Postman o la futura pantalla 008): `GET /surveys` lista la respuesta con su pedido y zona.
5. Perfil: cambiar solo el nombre → la cabecera cambia; cambiar el celular con `300 765 4322` → se muestra `+573007654322`; un celular inválido → error en el campo.
6. Contraseña: con la actual mal → 403 como error del campo (**confirmar que no te saca de la sesión**); con la nueva igual a la actual → 400; correcta → 204 y, si hay otra sesión del mismo cliente en otro navegador, esa cae con 401.
7. **Cuidado:** cinco contraseñas actuales erróneas seguidas bloquean la cuenta 15 minutos (comparte el contador del login); no hagas más de tres en la prueba.

## 9. Riesgos y pendientes

- **403 mal interpretado:** si la pasarela o `requestJson` tratan todo 403 como «sin permiso», el error de contraseña actual cerraría la sesión o redirigiría. Se revisa en el plan y se cubre con prueba.
- **Cuenta bloqueada por intentos:** el front no cuenta intentos (lo hace el back) y no puede distinguir «errada» de «bloqueada» (mismo 403 y texto); por eso la ayuda fija bajo el campo.
- **Encuesta irreversible:** un toque equivocado no se deshace; por eso el botón de enviar es separado de la elección y el aviso es visible. Si quieres otra política, es decisión de negocio del back.
- **Sesiones revocadas:** tras cambiar la contraseña, otras pestañas caen con 401 y el flujo normal de sesión vencida (001) las lleva al login.
- **Pedidos sin calificar de antes:** no hay límite de tiempo en el back; se puede calificar un entregado de hace semanas. No se aplica ninguno en el front.

## 10. Siguiente paso

`plan.md` (DP-01 a DP-11 aprobadas) → tu visto bueno → `tasks.md` → código y pruebas; me detengo para tu revisión.
