# Plan 006 — Cliente: encuesta y perfil

**Spec:** `spec.md` (aprobada el 2026-11-11, DP-01 a DP-11) · **Estado:** borrador (espera tu visto bueno) · **Siguiente paso tras aprobar:** `tasks.md` → código y pruebas

---

## 1. Enfoque

Sin dependencias nuevas ni cambios en el back. Se reutiliza lo ya construido: `requestJson`, `ApiError`/`describeApiError`, `FormField`, `PasswordInput`, `Alert`, la clave `['order', id]` del seguimiento en vivo y el patrón de hooks de 004b/005 (marca síncrona anti doble clic, callbacks `onDone`/`onFail`, sin reintento automático, comprobar el estado tras un corte de red).

Tres piezas independientes, en este orden: **mock** → **encuesta** (lógica, hook, tarjeta, integración en el detalle) → **perfil** (lógica, hooks, pantalla, navegación).

## 2. Hallazgos que condicionan el plan

1. **403 y la pasarela:** revisado el código: `requestJson` solo actúa con el 401 (`notifyUnauthorized`) y la pasarela `/api/[...path]` no trata el 403; el 403 de contraseña llega como `ApiError(403)` y se pinta en el campo. Se deja una prueba que lo fije (`json.test.ts`) y el E2E lo ejerce.
2. **Ruta `/api/auth/password`:** hay carpetas propias `src/app/api/auth/{login,logout,session,expired}`; `/auth/password` está en la tabla con `own: false`, así que la sirve la pasarela comodín. Se verifica con una prueba de `route.test.ts` y con el E2E (no se asume).
3. **403 de contraseña: errada = bloqueada.** El back lanza el mismo `ForbiddenException('La contraseña actual no es correcta.')` en ambos casos; el front no puede distinguirlos (ayuda fija bajo el campo, ver spec DP-08).
4. **Contraseña sin estado que consultar:** `PATCH /auth/password` responde 204 y no hay lectura que diga si cambió; tras un corte de red el aviso explica las dos posibilidades.
5. **`useDisplayName`** ya consulta `['customers','me']` con un tipo mínimo; se unifica con el nuevo `useProfile` (misma clave y misma función) para que guardar el perfil actualice la cabecera sin otra petición.
6. **Encuesta y caché:** el pedido ya trae `survey`; tras enviar se escribe en `['order', id]` (sin esperar al sondeo) y se invalida `['orders']`.

## 3. Archivos

**Mock (`tests/mock-api/`)**
- `orders.ts`: `survey` pasa de `null` a `{ rating, comment, createdAt } | null`; `survey(customerId, id, body)` con las reglas y los **textos exactos del back** (404 `Pedido no encontrado.`; 409 estado `El pedido #N está en estado «X»; la encuesta se responde cuando está «entregado».`; 409 `Este pedido ya tiene una respuesta de la encuesta.`; 400 por validación: `rating` entero 1–5, `comment` recortado 1–300, sin NUL).
- `profile.ts` (nuevo): `createProfileStore(customers)` con `update(customerId, body)` (mismas reglas que el back: al menos un campo, nombre 2–100 recortado, celular normalizado a E.164 o 400 `phone debe ser un celular colombiano o un número internacional válido.`, sin tocar `updatedAt` si nada cambia) y `changePassword(token, userId, body)` (403 `La contraseña actual no es correcta.` también bloqueada tras 5 fallos durante 15 min; 400 `La contraseña nueva debe ser distinta de la actual.`; 400 longitud 12–128; 204 y **revoca las demás sesiones** del usuario).
- `server.mts`: `POST /orders/:id/survey`, `PATCH /customers/me`, `PATCH /auth/password`; `GET /customers/me` devuelve también `createdAt` y `updatedAt`; `customers` guarda `createdAt`; reinicio con el reinicio general.
- `profile.test.ts` y pruebas de la encuesta (en `orders.test.ts` si existe, o `survey.test.ts`).

**Lógica y datos (`src/lib/`)**
- `survey/rating.ts`: `RATINGS` (1 Muy mala … 5 Excelente), `ratingLabel`, `COMMENT_MAX = 300`, `cleanComment(texto) → string | undefined` (recorta; vacío → `undefined`), `surveyBody(rating, comment)`.
- `survey/errors.ts`: `describeSurveyError(error) → { kind: 'already' | 'state' | 'missing' | 'validation' | 'ambiguous' | 'other', messages }` por estado y texto del back; `AMBIGUOUS_SURVEY`.
- `survey/use-submit-survey.ts`: `useSubmitSurvey(orderId, { onDone(survey, how), onFail(error) })` → `{ run(rating, comment), pending }`. Marca síncrona (`useRef`); 201 → escribe `survey` en `['order', id]`, invalida `['orders']`; 409 «ya tiene respuesta» → consulta el pedido y entrega la guardada (`how: 'already'`); corte de red/5xx → consulta el pedido: si ya trae `survey` → `how: 'recovered'`, si no → `onFail` ambiguo con `retryable`; 404 y 409 de estado → `onFail` y refresco del pedido. Sin `useMutation` (decide tras consultar, como 005).
- `profile/use-profile.ts`: `PROFILE_KEY = ['customers','me']`, `fetchProfile`, `useProfile()` (`staleTime` 5 min, sin reintentos automáticos de 4xx); `useDisplayName` pasa a usarlo.
- `profile/schemas.ts`: `profileSchema` (reutiliza las reglas de nombre y celular de `registerSchema`), `changedFields(original, values) → { fullName?, phone? }`, `passwordSchema` (12–128; nueva ≠ actual; repetición igual).
- `profile/errors.ts`: `describeProfileError(error)` (400 con `phone` → campo celular; otros → lista), `describePasswordError(error)` (403 → campo actual con el texto fijo; 400 «distinta» → campo nueva; 429 → mensaje; ambiguo → `AMBIGUOUS_PASSWORD`).
- `profile/use-update-profile.ts`: `useUpdateProfile({ onDone(profile), onFail(error) })` → `{ run(values), pending }`; marca síncrona; envía solo `changedFields`; 200 → `setQueryData(PROFILE_KEY, respuesta)`; tras corte de red consulta el perfil y, si ya coincide con lo pedido, lo da por hecho; si no, `onFail` ambiguo.
- `profile/use-change-password.ts`: `useChangePassword({ onDone, onFail })` → `{ run(current, next), pending }`; marca síncrona; 204 → `onDone`; nunca reintenta; no guarda las contraseñas en ningún estado fuera del formulario.

**Componentes**
- `components/survey/rating-input.tsx`: grupo de opciones (radio nativos con `sr-only` y estrellas visibles `lucide-react`, ≥ 48 px, flechas del teclado por el comportamiento nativo del radio, etiqueta de texto bajo la elegida).
- `components/survey/survey-card.tsx`: formulario (estrellas, comentario con contador, aviso «Al enviarla no podrás cambiarla», «Enviar calificación» deshabilitado sin estrella), `Alert`s de error y aviso «Entendido» para 409/404, ayuda «Reintentar» tras corte; al terminar muestra «Tu calificación» (estrellas + texto + comentario) y mueve el foco a su título.
- `components/survey/survey-summary.tsx`: «Tu calificación» de solo lectura (también para pedidos ya calificados al cargar).
- `components/orders/order-detail-view.tsx`: inserta `SurveyCard`/`SurveySummary` entre «Entrega» y «Pago» según `status`/`survey`, y una región `role="status"` (siempre en el DOM, vacía salvo cuando corresponde) con «Tu pedido #N fue entregado. ¡Cuéntanos qué tal estuvo!» — se anuncia al cambiar sin mover el foco y no se dispara en la carga inicial.
- `components/profile/profile-view.tsx` (carga/error/«Mis datos»), `profile-form.tsx`, `password-form.tsx`.
- `app/(app)/cliente/perfil/page.tsx` (con `metadata`) y `lib/auth/nav.ts` (`Mi perfil` habilitado; `nav.test.ts` actualizado).

**Pruebas y E2E**
- `src/lib/survey/{rating,errors}.test.ts`, `hooks.test.tsx` (envío, 409 ambos, corte con y sin guardado, doble clic, 404).
- `src/lib/profile/{schemas,errors}.test.ts`, `hooks.test.tsx`.
- `src/components/survey/survey-card.test.tsx`, `rating-input.test.tsx`; ampliar `order-detail-view.test.tsx`.
- `src/components/profile/{profile-view,password-form}.test.tsx`.
- `src/lib/api/json.test.ts`: el 403 no cierra la sesión; `route.test.ts`: `PATCH /api/auth/password` pasa por la pasarela.
- `e2e/survey.spec.ts`, `e2e/profile.spec.ts` (escritorio y móvil 360). Cada prueba usa su cliente nuevo (`newCustomerSession`), así que no se mezclan en paralelo.

## 4. Mapa CA → pruebas

| CA | Pruebas |
|---|---|
| CA-01 | `nav.test.ts`; E2E guardas de `/cliente/perfil` (visitante y otros roles). |
| CA-02 | `survey-card.test.tsx`, `order-detail-view.test.tsx` (los 4 casos: entregado sin/con survey, otros estados); E2E. |
| CA-03 | `rating-input.test.tsx` (nombres, flechas, deshabilitado), `survey-card.test.tsx` (comentario, contador, aviso), `rating.test.ts`. |
| CA-04 | `hooks.test.tsx` (cuerpos exactos, doble clic = un envío), `survey-card.test.tsx` (foco), E2E. |
| CA-05 | `errors.test.ts`, `hooks.test.tsx` (409 ambos, 404, 400, corte con y sin guardado), E2E (doble pestaña, corte con `page.route`). |
| CA-06 | `order-detail-view.test.tsx` (cambio a `entregado` → región `status`, sin mover foco, sin anuncio en la carga); E2E con el mock cambiando el estado en vivo. |
| CA-07 | `orders-view.test.tsx` sin cambios (fija que la lista no cambia); `hooks.test.tsx` (caché del pedido y lista tras enviar). |
| CA-08 | `profile-view.test.tsx` (datos, esqueleto, error + «Reintentar»). |
| CA-09 | `schemas.test.ts` (`changedFields`), `profile-view.test.tsx` (habilitado solo con cambios, solo campos modificados, 400 en campo, valor E.164, cabecera), E2E. |
| CA-10 | `schemas.test.ts`, `password-form.test.tsx`, `hooks.test.tsx`; E2E (204 y sesión viva). |
| CA-11 | `errors.test.ts`, `password-form.test.tsx` (403, ayuda fija, 429, sin conservar contraseñas), `json.test.ts`, E2E (403 sin cerrar sesión). |
| CA-12 | `hooks.test.tsx` (doble clic, sin reintento, corte: perfil consulta y contraseña explica), E2E. |
| CA-13 | Pruebas de componente (nombres, `aria-describedby`, `aria-live`, foco); revisión manual con lector de pantalla (tuya). |
| CA-14 | E2E 360 px: sin desborde, estrellas y botones ≥ 48 px; capturas que reviso yo. |
| CA-15 | Local: `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `audit`; E2E completo en la nube. |
| CA-16 | Todo lo anterior + pruebas del mock (`profile.test.ts`, encuesta). |

## 5. Orden de trabajo

1. Mock (encuesta, perfil, contraseña) + sus pruebas.
2. Encuesta: lógica (`rating`, `errors`), hook, `RatingInput`, `SurveyCard`/`SurveySummary`, integración en el detalle, pruebas.
3. Perfil: `useProfile` (y `useDisplayName`), esquemas, errores, hooks, formularios, pantalla, ruta y navegación, pruebas.
4. `json.test.ts` y `route.test.ts` (403 y `/auth/password`).
5. E2E de encuesta y de perfil (escritorio y 360 px), capturas.
6. Verificación completa, `tasks.md`, decisiones D-095 en adelante, `docs/commits/006.md`, README. **Me detengo para tu revisión; sin commit ni push.**

## 6. Riesgos y cómo se cubren

- **Texto de errores del back:** salen del código real (ver Anexo A) y no se inventan; si el back cambia un texto, el front cae en el mensaje del back.
- **Foco y anuncios:** la región `status` existe siempre para que el lector de pantalla la anuncie al cambiar; el foco solo se mueve tras una acción propia (enviar).
- **Doble envío entre pestañas:** lo resuelve el back (409); el front lo explica y muestra la guardada.
- **Contraseñas en memoria:** viven solo en el formulario (`react-hook-form`), se limpian al éxito y al error de red; nada en cachés, URL ni almacenamiento.
- **Número de teléfono distinto de lo escrito:** el front muestra lo que devuelve el back (E.164) y no reescribe mientras se teclea.

## Anexo A — Contrato verificado en el back (código, no ejecutado)

**Encuesta (`surveys.service.ts`)**: bajo bloqueo del pedido; 404 `Pedido no encontrado.` si no existe o es de otro cliente; 409 `El pedido #N está en estado «X»; la encuesta se responde cuando está «entregado».`; 409 `Este pedido ya tiene una respuesta de la encuesta.` (también si gana la carrera por la restricción única); 401 `Credenciales inválidas.` si el cliente ya no existe; 201 `{ orderId, rating, comment, createdAt }`. Validación: `rating` entero 1–5; `comment` recortado 1–300 y sin NUL.

**Perfil (`customers.service.ts`)**: `PATCH` con ningún campo → 400 `Indica al menos un campo para editar.`; solo escribe lo que cambia; celular a E.164 (`phone.ts`); 404 `CUSTOMER_NOT_FOUND`.

**Contraseña (`auth.service.ts`)**: bajo bloqueo del usuario; si `blockedUntil` está vigente → 403 `La contraseña actual no es correcta.`; contraseña actual errada → suma fallo (5 → bloqueo 15 min) y el mismo 403; nueva igual a la actual → 400 `La contraseña nueva debe ser distinta de la actual.`; éxito → cambia el hash, reinicia el contador, **revoca las demás sesiones** y responde 204.

## Siguiente paso

Tu visto bueno a este plan → `tasks.md` → código y pruebas.
