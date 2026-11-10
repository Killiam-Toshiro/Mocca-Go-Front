# Spec 001 — Base, login/registro y rutas por rol

**Repo:** `mocca-go-front` · **Fecha:** 2026-11-09 · **Estado:** aprobada el 2026-11-09 · v2.3 (BFF con cookie `httpOnly`; Railway; P-01 sin cambios en el back; TypeScript 5.9.3)
**Contrato consumido:** `docs/openapi.json` (back, incrementos 001–019) · **Siguiente paso tras aprobar:** `plan.md` → `tasks.md`

> **Cambio respecto a v1:** la sesión ya no vive en `sessionStorage`. Next.js actúa de intermediario (BFF): guarda el token en una cookie `httpOnly` y el navegador solo habla con `/api/...` del mismo origen. El back no cambia.

---

## 1. Objetivo

Dejar listo el esqueleto del frontend y la **puerta de entrada**: que una persona pueda registrarse (cliente), iniciar sesión (cliente o personal) y llegar a un panel propio de su rol, con la sesión protegida en el servidor y las rutas bloqueadas para quien no corresponde. Es la base de los incrementos 2–9.

## 2. Arquitectura de sesión (BFF)

```
Navegador ──(mismo origen, cookie httpOnly)──▶ Next.js (/api/...) ──(Bearer)──▶ Back NestJS (API_URL)
```

- El **token nunca llega al JavaScript del navegador**. Vive en una cookie `httpOnly` que solo Next lee.
- El navegador llama a `/api/...`; Next valida la petición, añade `Authorization: Bearer <token>` y la reenvía al back.
- Como la llamada al back es de servidor a servidor, **el front ya no necesita CORS**: no hay que añadir su dominio a `CORS_ORIGINS`.
- Los guardas son **del servidor** (middleware + layouts de Server Components): no hay destello de pantalla equivocada.

### Endpoints propios de Next (BFF)

| Ruta | Método | Función |
|---|---|---|
| `/api/auth/login` | POST | Llama a `POST /auth/login` del back; si es 200, pone las cookies, consulta `/auth/me` y responde `{ user: {id, username, role}, expiresAt }` **sin el token**. Si el back falla, reenvía estado y mensaje. |
| `/api/auth/logout` | POST | Llama a `POST /auth/logout` del back (mejor esfuerzo) y **siempre** borra las cookies. Responde 204. |
| `/api/auth/session` | GET | Llama a `/auth/me` con la cookie y responde `{ user, expiresAt }`; si el back da 401, borra las cookies y responde 401. |
| `/api/auth/expired` | GET | Borra las cookies y redirige a `/login?expired=1&next=…` (único GET con efecto; lo usan los guardas del servidor cuando detectan una sesión muerta, para evitar bucles). |
| `/api/[...path]` | GET/POST/PATCH/PUT/DELETE | Proxy a `${API_URL}/<path>` solo para las rutas de la tabla generada del OpenAPI (ver D-016). |

### Cookies (D-015)

| Cookie | Contenido | Atributos |
|---|---|---|
| `session` (en producción `__Host-session`) | El token | `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` en producción, `Max-Age = expiresIn` |
| `session_exp` | Solo la hora de vencimiento (epoch ms), dato no sensible | legible por JS, `SameSite=Lax`, `Path=/`, `Secure` en producción, mismo `Max-Age` |

El navegador descarta ambas cookies al vencer. `session_exp` permite al cliente programar el aviso de «sesión vencida» sin tocar el token.

### Qué cambia respecto a guardar el token en el navegador

- La sesión se comparte entre pestañas y sobrevive a enlaces abiertos en otra pestaña.
- Un XSS ya no puede **robar** el token, pero **sí puede hacer peticiones** mientras la página esté abierta: la CSP y las cabeceras de seguridad siguen siendo obligatorias (CA-21).
- Con cookies existe **CSRF**: se mitiga con `SameSite=Lax`, verificación de `Origin` y exigencia de `Content-Type: application/json` (D-017).
- El proxy es **código de seguridad**: solo reenvía rutas conocidas, no es un proxy abierto (D-016).
- Los límites por IP del back verían la IP del servidor de Next: Next reenvía la IP real del cliente en `X-Forwarded-For` y el back ya la acepta con `TRUST_PROXY_HOPS=1` (D-023, P-01).

## 3. Decisiones

### Ya tomadas

| ID | Decisión | Origen |
|---|---|---|
| D-001 | Solo web responsive (sin panel de escritorio aparte) | Usuario |
| D-002 | Tailwind + shadcn/ui | Usuario |
| D-003 | ~~Despliegue en Vercel~~ **reemplazada por D-022** | Usuario |
| D-004 | ~~Token en `sessionStorage`~~ **reemplazada por D-014** | Usuario |
| D-005 | Next.js App Router, TypeScript estricto, npm, Node 24 | Handoff §10 |
| D-006 | Cliente tipado con `openapi-typescript` + `openapi-fetch`; TanStack Query | Handoff §4 y §10 |
| D-014 | Sesión en cookie `httpOnly` emitida por Next (BFF); el navegador solo usa `/api/...` del mismo origen | Usuario, 2026-11-09 |
| D-022 | Despliegue del front en **Railway** como contenedor Node persistente (`next build` + `next start`), con el back en la misma plataforma y `API_URL` apuntando a su red privada. Motivo: los canales SSE pasan por el proxy y necesitan conexiones largas sin cortes por duración de función. | Usuario, 2026-11-09 |

### Aprobadas el 2026-11-09 (D-007 a D-013 y D-015 a D-025)

| ID | Propuesta | Alternativa |
|---|---|---|
| D-007 | `npm run api:types` quita `/api/v1` de los paths de `docs/openapi.json` y genera `src/lib/api/schema.d.ts` (tipos) **y** `src/lib/api/routes.generated.ts` (tabla de rutas del proxy). El cliente usa `baseUrl: "/api"`. | Escribir la tabla de rutas a mano. |
| D-008 | Un único campo «Usuario o correo»: con `@` se envía `email`, si no `username`. | Dos pestañas cliente / personal. |
| D-009 | Tras registrarse se inicia sesión automáticamente. Si falla, va a `/login` con aviso. | Redirigir siempre a `/login`. |
| D-010 | El rol se obtiene de `GET /auth/me` (lo hace el BFF), no del JWT. | Leer el rol del JWT. |
| D-011 | Rutas por prefijo de rol; el rol equivocado se redirige a su home. | Pantalla «Sin acceso». |
| D-012 | `admin` solo accede a `/admin` en este incremento; cocina/despacho de consulta se deciden en los incrementos 4 y 5. | Acceso a todos los prefijos. |
| D-013 | Puerto de desarrollo `3001`. | — |
| D-015 | Cookies `session` + `session_exp` con los atributos de la tabla anterior. | Una sola cookie y decodificar el `exp` del JWT en el servidor. |
| D-016 | El proxy solo reenvía `método + ruta` presentes en `routes.generated.ts`, normaliza la ruta (rechaza `..`, `%2f`, `//`), usa un host fijo (`API_URL`), pasa solo cabeceras permitidas (`Content-Type`, `Accept`, `Idempotency-Key`) y añade un `X-Forwarded-For` calculado por el servidor (D-023), nunca copiado del cliente; **no** reenvía la cookie al back y devuelve el cuerpo como flujo (sin almacenarlo). `login` y `logout` del back quedan fuera del proxy. | Denylist de rutas. |
| D-017 | Métodos no seguros (POST/PATCH/PUT/DELETE) exigen `Origin` presente cuyo host coincida con el del servidor (`X-Forwarded-Host` o `Host`, más `ALLOWED_ORIGINS` opcional) y `Content-Type: application/json` si hay cuerpo. | Token CSRF doble envío. |
| D-018 | Guardas en dos capas: **middleware** (si no hay cookie `session` en un prefijo privado → `/login?next=…`) y **layouts de Server Components** (validan con `/auth/me`, comprueban el rol y pasan el usuario a un `SessionProvider` cliente). | Solo layouts. |
| D-019 | Variable de servidor `API_URL` (con `/api/v1`, p. ej. `http://localhost:3000/api/v1`) reemplaza a `NEXT_PUBLIC_API_URL`. No se expone al navegador. En Railway apunta a la **red privada** del servicio `api` (`http://<servicio>.railway.internal:<puerto>/api/v1`), no al dominio público, para que la IP del cliente llegue al back. | — |
| D-020 | Las pruebas E2E y de integración usan un **servidor mock de la API** en Node (`tests/mock-api`) al que apunta `API_URL`, porque las llamadas de Next al back no se pueden interceptar con `page.route`. | MSW en modo Node. |
| D-023 | **IP real hacia el back sin cambiar el back:** variable de servidor `TRUST_PROXY_HOPS` (0 en local, 1 en Railway; mismo criterio que el back). Con n > 0, el proxy de API toma la IP del cliente de `X-Forwarded-For` contando n entradas desde la derecha (con 1, la última, que añade el borde de Railway; las anteriores las puede falsear el cliente), la valida como IP y la envía al back **sustituyendo** cualquier `X-Forwarded-For` entrante. Con 0 no envía la cabecera. | Copiar la cabecera tal cual (falseable). |
| D-024 | `COOKIE_SECURE` (opcional) fuerza `Secure` y el prefijo `__Host-`; por defecto `true` si `NODE_ENV=production`. Permite correr un build de producción en `http://localhost` para E2E. | Depender solo de `NODE_ENV`. |
| D-025 | TypeScript fijado en 5.9.3: `typescript-eslint` 8.72 solo admite `<6.1` y `openapi-typescript` 7.13 declara `typescript@^5.x` (ajustado en T-01; la propuesta inicial decía 6.0.x). | Usar TypeScript 6 o 7 con `--legacy-peer-deps`. |

### Pendientes abiertos

| ID | Pendiente | Cuándo se resuelve |
|---|---|---|
| P-01 | **Back:** reenviar la IP real. Next enviará `X-Forwarded-For` con la IP del cliente y el back debe configurar `trust proxy` confiando solo en ese salto; si no, todos los usuarios compartirían los límites por IP (login 20/min, registro 5/min, pedidos, SSE). Con el back en la red privada de Railway, confiar en un solo salto es seguro; si el back siguiera público, alguien podría falsear la IP y saltarse los límites (habría que cerrarlo o firmar el reenvío con un secreto compartido). | Antes del despliegue (inc. 9); en local no afecta |
| P-02 | ~~Hosting: Vercel o Railway~~ **Resuelto: Railway (D-022).** Queda por verificar en el incremento 3 el límite de duración de petición del proxy de Railway; el protocolo reconecta igualmente con `ready`. | Incremento 3 |
| P-03 | Confirmar qué devuelve `/auth/me` como `username` para un cliente (decide cómo se muestra su nombre). | Verificación manual del inc. 1 |

## 4. Alcance

**Entra**
1. Repo y tooling: Next.js, TS estricto, Tailwind, shadcn/ui, ESLint, Prettier, Vitest + Testing Library, Playwright con servidor mock.
2. Configuración por entorno (`API_URL`) validada al arrancar en el servidor.
3. Cliente de API tipado y tabla de rutas generados desde `docs/openapi.json`.
4. BFF: endpoints de sesión, proxy, cookies, verificación de `Origin`.
5. Guardas por rol (middleware + layouts) y panel inicial (placeholder) de cada rol, con *shell* responsive.
6. Pantallas `/login` y `/registro`.
7. Cabeceras de seguridad y CSP con nonce.

**No entra**
- Menú, carrito, pedidos, SSE, cocina, despacho, encuestas, catálogo, métricas. (El proxy se diseña para pasar flujos, pero el SSE se implementa y prueba en el incremento 3.)
- Cambio de contraseña (`PATCH /auth/password`) y perfil editable: incremento 6.
- Identidad visual definitiva (se usa tema neutro con tokens reemplazables) y despliegue.

## 5. Contrato consumido en este incremento

| Operación del back | Cuerpo / respuesta relevante | Errores a manejar |
|---|---|---|
| `POST /auth/login` | Cuerpo: `password` (12–128) y **exactamente uno** de `username` (`^[a-z0-9][a-z0-9._-]{2,63}$`) o `email` (≤254). Respuesta: `{ accessToken, tokenType:"Bearer", expiresIn }` (segundos). **No trae el rol.** | 400 (`message` puede ser arreglo) · 401 credenciales inválidas **o cuenta bloqueada** (5 fallos = 15 min) · 429 (20/min por IP) |
| `GET /auth/me` | `{ id, username, role }`, `role ∈ admin, operador, repartidor, cliente` | 401 |
| `POST /auth/logout` | 204; revoca la sesión | 401 |
| `POST /customers` | Cuerpo: `email` (≤254), `password` (12–128), `fullName` (2–100), `phone` (celular colombiano o `+…`; el back guarda E.164). 201 → `CustomerResponse`. **No inicia sesión.** Pública (el proxy no exige cookie). | 400 · 409 correo ya registrado · 429 (5/min por IP) |
| `GET /customers/me` | `{ id, email, fullName, phone, … }` (solo cliente) | 401 · 403 · 404 |

Formato de error del back: `{ statusCode, message: string | string[], error? }`, en español. Los errores propios del BFF (502 sin conexión con el back, 504 tiempo agotado, 401 sin cookie, 403 `Origin` inválido, 415 tipo de contenido, 404 ruta fuera de la tabla) usan **el mismo formato**.

### Hallazgos al cruzar el handoff con el OpenAPI

1. Los paths del OpenAPI incluyen `/api/v1` y `servers` viene vacío. Se quita el prefijo al generar (D-007) y `API_URL` ya lo lleva; el navegador usa `/api`.
2. `/auth/me` solo devuelve `id`, `username`, `role`: para el nombre completo de un cliente hay que pedir `GET /customers/me`.
3. El 401 de login no distingue cuenta bloqueada de contraseña errónea; se muestra el `message` del servidor.
4. Un 403 en `PATCH /auth/password` significa «contraseña actual incorrecta», **no** falta de permiso: ni el proxy ni el cliente deben tratar todo 403 como cierre de sesión (relevante en el incremento 6).
5. TTL: el OpenAPI dice 15 min y el handoff 8 h por defecto. Se usa siempre `expiresIn`.
6. Para el incremento 3: el handoff dice `POST /orders` 10/min por IP y el OpenAPI 20/min. Confirmar con el back.
7. Con BFF, el handoff §4 sobre `CORS_ORIGINS` deja de aplicar al front (el back solo lo necesita para Swagger u otros orígenes).
8. El CORS del back solo permite las cabeceras `Authorization` y `Content-Type`; **no incluye `Idempotency-Key`**, así que `POST /orders` llamado directo desde el navegador fallaría en el preflight. El BFF lo evita porque la llamada es de servidor a servidor.
9. El back **ya soporta proxies de confianza** (`TRUST_PROXY_HOPS`, D-56 del back; vale `1` en Railway) y su limitador usa la IP de Express (`req.ip`). P-01 no requiere cambios en el back: basta con que Next envíe `X-Forwarded-For` con la IP real y llame por la red privada (D-023).

## 6. Rutas y guardas

| Ruta | Acceso | Contenido en este incremento |
|---|---|---|
| `/` | Público | Portada mínima con enlaces a login y registro; con sesión, botón «Ir a mi panel». En el incremento 2 pasa a ser el menú. |
| `/login`, `/registro` | Solo sin sesión válida (con sesión → home del rol) | Formularios |
| `/cliente`, `/operador`, `/repartidor`, `/admin` | Su rol | Panel placeholder (saludo, rol y secciones futuras deshabilitadas) |

Home por rol: `cliente → /cliente`, `operador → /operador`, `repartidor → /repartidor`, `admin → /admin`. La matriz rol → prefijos vive en `lib/auth/roles.ts`.

**Flujo de un guarda:** middleware (¿hay cookie `session`? si no → `/login?next=<ruta>`) → layout del servidor (`getSession()` con `/auth/me`; 401 → `/api/auth/expired?next=…`; rol equivocado → home propio) → `SessionProvider` entrega el usuario a los componentes cliente.

## 7. Comportamiento de la sesión

- **Login:** el formulario llama a `POST /api/auth/login`; el servidor fija las cookies y responde `{ user, expiresAt }`. El cliente redirige al home del rol (o a `next` si es válido).
- **Recarga:** la cookie persiste; el layout del servidor valida con `/auth/me` antes de renderizar.
- **Expiración:** la cookie caduca sola (`Max-Age = expiresIn`). Un temporizador cliente lee `session_exp` y, al vencer, limpia la caché de consultas y lleva a `/login?expired=1` con «Tu sesión venció. Inicia sesión de nuevo.». No hay refresh en el back.
- **401 del back en ruta privada:** el proxy borra las cookies y reenvía el 401; el cliente limpia la caché y va a `/login?expired=1&next=…`. Un 401 de `/api/auth/login` (credenciales malas) **no** dispara este flujo.
- **Logout:** `POST /api/auth/logout`; pase lo que pase se borran las cookies y la caché y se va a `/login`.
- **`next`:** solo se respeta si es una ruta interna (empieza con `/`, no con `//`, sin esquema ni `\`) **y** el rol puede entrar; si no, home del rol.

## 8. Formularios

**Login:** «Usuario o correo» (`autocomplete="username"`), contraseña con mostrar/ocultar (`autocomplete="current-password"`), «Ingresar» con estado de carga, enlace a registro.

**Registro:** correo (`email`), contraseña 12–128 (`new-password`), nombre completo 2–100 (`name`), teléfono (`tel`; solo se valida no vacío y forma razonable, la validación real es del back).

**Errores del servidor:** `message` como arreglo → lista en una alerta; 409 en registro → bajo el campo correo; 429 → «Demasiados intentos, espera un momento e inténtalo de nuevo»; 502/504 → «No pudimos conectar con el servidor». Validación con `react-hook-form` + `zod`, mensajes en español (`es-CO`).

## 9. Seguridad (transversal)

- **Cabeceras en todas las respuestas de página:** `Content-Security-Policy` con nonce por petición (`default-src 'self'`, `script-src 'self' 'nonce-…' 'strict-dynamic'`, `connect-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'self'`, `frame-ancestors 'none'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Frame-Options: DENY`, `Permissions-Policy` restrictiva y `Strict-Transport-Security` en producción. Como todo va por el mismo origen, `connect-src` no necesita el dominio del back.
- **Respuestas privadas:** `Cache-Control: no-store`.
- **Secretos:** nada sensible en variables `NEXT_PUBLIC_*`; el servidor no registra cuerpos de login/registro, contraseñas ni tokens.
- **Dependencias:** `package-lock.json` versionado, instalación con `npm ci`, `npm audit` sin vulnerabilidades altas/críticas y Dependabot activo; el código de shadcn se revisa al incorporarlo.
- **Sin `dangerouslySetInnerHTML`** ni scripts de terceros.

## 10. Criterios de aceptación

| ID | Criterio |
|---|---|
| CA-01 | `npm run dev` levanta en `:3001` y muestra la portada; `lint`, `typecheck`, `test` y `build` terminan sin errores. |
| CA-02 | Si `API_URL` falta o no es una URL válida, el servidor falla al iniciar con un mensaje que nombra la variable. Existe `.env.example`. `TRUST_PROXY_HOPS` (entero 0–10, por defecto 0) y `COOKIE_SECURE` se validan igual. `API_URL` no aparece en ningún archivo servido al navegador. |
| CA-03 | `npm run api:types` genera `schema.d.ts` y `routes.generated.ts` (método, patrón y si es pública) desde `docs/openapi.json`, con paths sin `/api/v1`; el cliente usa `baseUrl: "/api"` y compila. |
| CA-04 | Login con `username` válido fija las cookies, responde `{ user, expiresAt }` sin el token y redirige al home del rol (`operador → /operador`, `repartidor → /repartidor`, `admin → /admin`). |
| CA-05 | Atributos de cookies: `session` es `HttpOnly`, `SameSite=Lax`, `Path=/`, con `Max-Age = expiresIn` y `Secure` en producción; `document.cookie` no contiene el token; el token no aparece en ninguna respuesta enviada al navegador. |
| CA-06 | Login con correo (texto con `@`) envía `email`, no `username`, y lleva a `/cliente`. |
| CA-07 | Login con 400 (arreglo de mensajes), 401, 429, 502/504 muestra el mensaje correspondiente sin perder lo escrito en el campo usuario. |
| CA-08 | Registro válido: `POST /customers` por el proxy (sin cookie) → login automático → `/cliente`. Si el login automático falla, va a `/login` con aviso de cuenta creada. |
| CA-09 | Registro con correo repetido (409), 400 y 429 muestra el mensaje del servidor donde corresponde y conserva los datos (no la contraseña). |
| CA-10 | Con datos inválidos (correo mal formado, contraseña <12 o >128, nombre <2 o >100, teléfono vacío) no se envía petición y se muestran mensajes por campo. |
| CA-11 | Al recargar con sesión vigente, la página se renderiza ya autenticada (sin destello ni pasar por login); el layout valida con `/auth/me`. |
| CA-12 | Al vencer la sesión el navegador descarta las cookies y el cliente muestra `/login?expired=1` con el aviso; una petición posterior sin cookie recibe 401 del proxy y lleva al mismo flujo. |
| CA-13 | Guardas: sin cookie, ruta privada → `/login?next=…` (middleware); rol equivocado → home propio; cookie con sesión muerta (back responde 401) → `/api/auth/expired` borra cookies → `/login?expired=1` **sin bucle**; con sesión válida, `/login` y `/registro` → home. |
| CA-14 | `next` externo o malformado (`https://…`, `//…`, `javascript:…`, con `\`, ruta de otro rol) se ignora y se usa el home del rol. |
| CA-15 | Proxy: una ruta o método fuera de `routes.generated.ts` → 404; rutas con `..`, `%2f` o `//` → rechazadas; ruta privada sin cookie → 401 local sin llamar al back; añade `Authorization` desde la cookie y **no** reenvía la cookie; pasa solo las cabeceras permitidas; reenvía estado y mensaje del back; un 401 del back en ruta privada borra las cookies; fallo de conexión → 502 y tiempo agotado → 504 en el formato de error estándar. |
| CA-16 | CSRF: POST/PATCH/PUT/DELETE sin `Origin` o con `Origin` de otro host → 403; cuerpo con `Content-Type` distinto de `application/json` → 415; ningún GET modifica datos (la única excepción es `/api/auth/expired`, que solo borra cookies). |
| CA-17 | Logout llama a `POST /auth/logout` del back, borra cookies y caché y lleva a `/login`; si la llamada al back falla, igual se borran las cookies; el token revocado da 401 en el back. |
| CA-18 | El proxy devuelve el cuerpo del back como flujo (no lo acumula): se comprueba con un mock que emite fragmentos con retraso. (Base del SSE del incremento 3.) |
| CA-19 | El *shell* muestra marca, nombre/rol y «Salir»; la navegación lista solo secciones del rol; es usable desde 360 px (menú en panel lateral) hasta escritorio. |
| CA-20 | Accesibilidad: etiquetas asociadas, `autocomplete` correctos, foco visible, errores anunciados (`aria-live`), formularios operables con teclado, contraste AA. |
| CA-21 | Todas las páginas responden con las cabeceras de la §9 y un nonce distinto por petición; en E2E no hay violaciones de CSP en consola. |
| CA-22 | El token no aparece en URLs, consola, HTML ni logs del servidor; los logs no incluyen cuerpos de login/registro; `npm audit` sin altas/críticas; `package-lock.json` versionado y Dependabot configurado. |
| CA-23 | Pruebas: unitarias (matcher de rutas, normalización de ruta, verificación de `Origin`, constructores de cookies, `next` seguro, mapeo de errores), de componente (formularios, `SessionProvider`), de integración de route handlers contra el mock y E2E con Playwright contra `tests/mock-api` (login de cada rol, registro, rol equivocado, expiración, sesión muerta sin bucle, CSRF 403). |
| CA-24 | IP real: con `TRUST_PROXY_HOPS=1` el proxy de API envía al back `X-Forwarded-For` con la última IP válida de la cabecera entrante, **sustituyendo** la del cliente; con una cabecera entrante falsificada (`1.2.3.4, 9.9.9.9`) el back recibe solo `9.9.9.9`; con `0`, o sin cabecera, o con un valor que no es IP, no se envía. Se prueba contra el mock. |

## 11. Verificación contra el back real

Con el back local (`db:up`, `migration:run`, `seed`, `start:dev` en `:3000`) y `API_URL=http://localhost:3000/api/v1`:

1. Login como `admin`, `operador` y `repartidor` (contraseñas `SEED_*` del `.env` del back): cada uno aterriza en su panel. En DevTools, las cookies aparecen `HttpOnly` y `document.cookie` no muestra el token.
2. Registrar un cliente (`300 765 4322`): entra a `/cliente`.
3. Cerrar sesión y comprobar que el mismo token da 401 directo contra el back.
4. Con una cookie manipulada o borrada a mano: no hay bucle y se llega a `/login`.
5. Resolver P-03 (valor de `username` de un cliente en `/auth/me`).

La evidencia (comandos y salidas) va en `docs/commits/001.md`.

## 12. Estructura propuesta del repo

```
src/
  proxy.ts                      # guardas + CSP con nonce (Next 16; antes middleware.ts)
  app/
    (public)/                   # /, /login, /registro
    (private)/cliente|operador|repartidor|admin/   # layouts con getSession()
    api/
      auth/{login,logout,session,expired}/route.ts
      [...path]/route.ts        # proxy
  components/{ui,layout}/
  features/auth/                # formularios, SessionProvider, hooks
  lib/
    api/                        # cliente, schema.d.ts, routes.generated.ts, ApiError
    auth/                       # roles, safe-next
    server/                     # (server-only) env, session, proxy, origin, cookies
docs/ (openapi.json, decisions.md, commits/)
specs/001-base-auth-roles/ (spec.md, plan.md, tasks.md)
scripts/gen-api.mjs
tests/mock-api/                 # servidor mock para integración y E2E
```

## 13. Riesgos

- **IP real hacia el back (P-01, D-023):** si `API_URL` apunta al dominio público en vez de a la red privada, o Next no envía `X-Forwarded-For`, los límites por IP se comparten entre todos los usuarios. Se verifica en el despliegue (incremento 9).
- **SSE por el proxy:** en Railway (contenedor persistente) no hay cortes por duración de función, pero hay que verificar el límite de duración de petición de su proxy y mantener la reconexión con `ready`. Se prueba en el incremento 3.
- **XSS sigue siendo grave:** puede actuar como el usuario mientras la página esté abierta. Mitigación: CSP con nonce, sin `dangerouslySetInnerHTML`, política de dependencias.
- **El proxy concentra riesgo:** un error en la normalización de rutas o en la tabla lo convertiría en proxy abierto; por eso CA-15 y CA-16 tienen pruebas dedicadas.
- **Sin refresh en el back:** cada vencimiento obliga a iniciar sesión de nuevo (se conserva `next`).
- **Nombres:** en Next 16 el antiguo `middleware.ts` es `src/proxy.ts` (runtime Node). No confundirlo con el proxy de API (`/api/[...path]`), que en el plan se llama «pasarela». En esta spec, «middleware» significa `proxy.ts`.
- **Identidad visual sin definir:** tema neutro; se cambia por tokens de Tailwind sin tocar componentes.

## 14. Siguiente paso

Spec, plan y tareas aprobados. Implementado y en revisión; T-24 (back real) parcial. Ver `docs/commits/001.md`.
