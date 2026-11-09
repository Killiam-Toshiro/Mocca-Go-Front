# Spec 001 — Base, login/registro y rutas por rol

**Repo:** `mocca-go-front` (nuevo) · **Fecha:** 2026-11-09 · **Estado:** borrador para aprobación
**Contrato consumido:** `openapi.json` del back (incrementos 001–019) · **Siguiente paso tras aprobar:** `plan.md` → `tasks.md`

---

## 1. Objetivo

Dejar listo el esqueleto del frontend y la **puerta de entrada**: que una persona pueda registrarse (cliente), iniciar sesión (cliente o personal) y llegar a un panel propio de su rol, con la sesión protegida y las rutas bloqueadas para quien no corresponde. Es la base sobre la que se montan los incrementos 2–9.

## 2. Decisiones ya tomadas (para `docs/decisions.md`)

| ID | Decisión | Origen |
|---|---|---|
| D-001 | Solo web responsive (sin panel de escritorio aparte) | Respuesta del usuario |
| D-002 | Tailwind + shadcn/ui | Respuesta del usuario |
| D-003 | Despliegue en Vercel (incremento 9); el dominio se añade a `CORS_ORIGINS` del back | Respuesta del usuario |
| D-004 | Token en `sessionStorage` | Respuesta del usuario |
| D-005 | Next.js App Router, TypeScript estricto, npm (igual que el back), Node 24 | Handoff §10 + coherencia con el back |
| D-006 | Cliente tipado con `openapi-typescript` + `openapi-fetch`; consultas con TanStack Query | Handoff §4 y §10 |

### Consecuencias de D-004 que condicionan el diseño

- El token vive solo en el navegador, así que **Next no puede proteger rutas en el servidor** (`middleware.ts` no ve la sesión). Los guardas son **del lado del cliente** y sirven para UX; la seguridad real la impone el back (401/403).
- Todas las páginas privadas son *client components* con TanStack Query; no se hace `fetch` autenticado desde Server Components.
- `sessionStorage` es por pestaña: abrir un enlace en pestaña nueva no hereda la sesión. Es un costo aceptado.
- Riesgo: un XSS podría leer el token. Mitigación en este incremento: sin `dangerouslySetInnerHTML`, el token nunca va en URLs ni logs, y solo se envía al origen de `NEXT_PUBLIC_API_URL`.

## 3. Alcance

**Entra**
1. Repo y tooling: Next.js, TS estricto, Tailwind, shadcn/ui, ESLint, Prettier, Vitest + Testing Library, Playwright (con la API simulada).
2. Configuración por entorno (`NEXT_PUBLIC_API_URL`) validada al arrancar.
3. Cliente de API tipado generado desde `docs/openapi.json`, con manejo uniforme de errores.
4. Módulo de sesión: guardar, restaurar, expirar y cerrar.
5. Pantallas `/login` y `/registro`.
6. Guardas por rol y panel inicial (placeholder) de cada rol, con *shell* responsive.

**No entra** (queda para otros incrementos)
- Menú, carrito, pedidos, SSE, cocina, despacho, encuestas, catálogo, métricas.
- Cambio de contraseña (`PATCH /auth/password`) y perfil (`/customers/me` editable): incremento 6.
- Diseño visual definitivo (logo, paleta de marca). Se usa un tema neutro con tokens de color reemplazables.
- Despliegue (incremento 9).

## 4. Contrato consumido en este incremento

| Operación | Cuerpo / respuesta relevante | Errores a manejar |
|---|---|---|
| `POST /auth/login` | Cuerpo: `password` (12–128) y **exactamente uno** de `username` (`^[a-z0-9][a-z0-9._-]{2,63}$`) o `email` (≤254). Respuesta: `{ accessToken, tokenType:"Bearer", expiresIn }` (segundos). **No trae el rol.** | 400 validación (`message` puede ser arreglo) · 401 credenciales inválidas **o cuenta bloqueada** (5 fallos = 15 min) · 429 (20/min por IP) |
| `GET /auth/me` | `{ id, username, role }` con `role ∈ admin, operador, repartidor, cliente` | 401 |
| `POST /auth/logout` | 204; revoca la sesión | 401 (ya revocada) |
| `POST /customers` | Cuerpo: `email` (≤254), `password` (12–128), `fullName` (2–100), `phone` (celular colombiano o `+…`; el back lo guarda en E.164). 201 → `CustomerResponse`. **No inicia sesión.** | 400 · 409 correo ya registrado · 429 (5/min por IP) |
| `GET /customers/me` | `{ id, email, fullName, phone, … }` (solo cliente) | 401 · 403 · 404 |

Formato de error: `{ statusCode, message: string | string[], error? }`, con mensajes en español que se pueden mostrar.

### Hallazgos al cruzar el handoff con el OpenAPI

1. **Los paths del OpenAPI incluyen `/api/v1`** y `servers` viene vacío, mientras que `NEXT_PUBLIC_API_URL` ya termina en `/api/v1`. Hay que quitar el prefijo al generar los tipos (ver D-007) para no duplicarlo.
2. **`/auth/me` solo devuelve `id`, `username`, `role`.** No hay nombre completo; para saludar a un cliente por su nombre hay que pedir `GET /customers/me`.
3. **El 401 de login no distingue cuenta bloqueada de contraseña errónea**; se muestra el `message` del servidor tal cual.
4. **Un 403 en `PATCH /auth/password` significa «contraseña actual incorrecta»**, no «sin permiso». El manejador global no debe tratar todo 403 como falta de rol (relevante para el incremento 6).
5. **TTL del token:** el OpenAPI dice 15 min y el handoff dice 8 h por defecto (`ACCESS_TOKEN_TTL_SECONDS`). Se usa siempre `expiresIn` de la respuesta, nunca un valor fijo.
6. Para el incremento 3: el handoff dice `POST /orders` 10/min por IP y el OpenAPI 20/min. Confirmar con el back.

## 5. Decisiones de diseño propuestas (requieren tu visto bueno)

| ID | Propuesta | Alternativa |
|---|---|---|
| D-007 | Script `npm run api:types` que copia/limpia `docs/openapi.json` (quita `/api/v1` de cada path) y genera `src/lib/api/schema.d.ts`, que se versiona. | Usar `/api/v1` en el `baseUrl` y dejar los paths completos (obliga a que `NEXT_PUBLIC_API_URL` sea solo el origen, distinto de lo que dice el handoff). |
| D-008 | Un único campo «Usuario o correo»: si contiene `@` se envía `email`, si no `username` (el patrón de username no admite `@`, así que no hay ambigüedad). | Dos pestañas «Soy cliente / Soy personal». |
| D-009 | Tras `POST /customers` exitoso se inicia sesión automáticamente con las mismas credenciales. Si ese login falla, se lleva a `/login` con aviso «Cuenta creada, inicia sesión». | Redirigir siempre a `/login`. |
| D-010 | El rol se obtiene con `GET /auth/me` después del login (no se decodifica el JWT en el front). | Leer el rol del JWT: se evita una llamada, pero se confía en un dato sin verificar. |
| D-011 | Rutas por rol bajo prefijo: `/cliente`, `/operador`, `/repartidor`, `/admin`. Un rol que entra a un prefijo ajeno es **redirigido a su home** (sin pantalla 403). `/`, `/login` y `/registro` son públicas. | Pantalla «Sin acceso». |
| D-012 | En este incremento `admin` solo accede a `/admin`. Si cocina y despacho de consulta se reutilizan para admin se decide en los incrementos 4 y 5 (probablemente bajo `/admin/…`). | Dar a `admin` acceso a todos los prefijos desde ya. |
| D-013 | Puerto de desarrollo `3001` (así coincide con el `CORS_ORIGINS` local del back). | — |

## 6. Rutas y guardas

| Ruta | Acceso | Contenido en este incremento |
|---|---|---|
| `/` | Público | Portada mínima con enlaces a login y registro; si hay sesión, botón «Ir a mi panel». En el incremento 2 pasa a ser el menú. |
| `/login` | Solo sin sesión (con sesión → home del rol) | Formulario de login |
| `/registro` | Solo sin sesión (con sesión → home del rol) | Formulario de registro de cliente |
| `/cliente` | `cliente` | Panel placeholder |
| `/operador` | `operador` | Panel placeholder |
| `/repartidor` | `repartidor` | Panel placeholder |
| `/admin` | `admin` | Panel placeholder |

Home por rol: `cliente → /cliente`, `operador → /operador`, `repartidor → /repartidor`, `admin → /admin`. La matriz rol → prefijos permitidos vive en un solo módulo (`lib/auth/roles.ts`) para que los incrementos siguientes solo la extiendan.

Los paneles placeholder muestran saludo, rol y la lista de secciones que llegan después (deshabilitadas), para validar el *shell* y la navegación por rol.

## 7. Comportamiento de la sesión

- **Guardado:** `{ accessToken, expiresAt }` en `sessionStorage` (`expiresAt = ahora + expiresIn`). La identidad (`id`, `username`, `role`) se mantiene en estado de la app, no se persiste.
- **Arranque / recarga:** si hay token y no ha vencido → `GET /auth/me`; mientras responde se muestra un *skeleton* (nunca un destello de la pantalla equivocada). Si responde 401 → se limpia la sesión.
- **Expiración:** un temporizador a `expiresAt` cierra la sesión y lleva a `/login?expired=1` con el mensaje «Tu sesión venció. Inicia sesión de nuevo.». No hay refresh en el back.
- **401 en cualquier petición privada** (excepto `/auth/login`): limpiar sesión y caché de consultas y redirigir como en la expiración.
- **Logout:** `POST /auth/logout`; pase lo que pase (incluso error de red o 401) se borra el token local, se vacía la caché y se va a `/login`.
- **`next`:** al ser expulsado de una ruta privada se envía a `/login?next=<ruta>`. Tras el login solo se respeta si es una ruta interna (empieza con `/`, no con `//`, sin esquema) **y** el rol puede entrar; si no, va al home del rol.
- **Autorización a la API:** `Authorization: Bearer <token>` solo hacia el origen configurado.

## 8. Formularios

**Login**: campo «Usuario o correo», contraseña (con mostrar/ocultar), botón «Ingresar» (deshabilitado y con estado de carga mientras envía), enlace a registro. Cliente-side: campos requeridos, contraseña 12–128, correo con formato si lleva `@`.

**Registro**: correo, contraseña (12–128, con mostrar/ocultar), nombre completo (2–100), teléfono. El teléfono solo se valida como no vacío y con forma razonable (dígitos, espacios, `+`); la normalización a E.164 y la validación real son del back, cuyo mensaje se muestra.

**Errores del servidor:** `message` como arreglo → lista dentro de una alerta del formulario; 409 en registro → mensaje bajo el campo correo; 429 → «Demasiados intentos, espera un momento e inténtalo de nuevo»; falla de red → «No pudimos conectar con el servidor».

Validación con `react-hook-form` + `zod`, mensajes en español. Idioma de la interfaz: `es-CO`.

## 9. Criterios de aceptación

| ID | Criterio |
|---|---|
| CA-01 | `npm run dev` levanta en `:3001` y muestra la portada; `npm run lint`, `typecheck`, `test` y `build` terminan sin errores. |
| CA-02 | Si `NEXT_PUBLIC_API_URL` falta o no es una URL válida, la app falla al iniciar con un mensaje que nombra la variable. Existe `.env.example`. |
| CA-03 | `npm run api:types` genera `schema.d.ts` desde `docs/openapi.json` con paths sin `/api/v1`; el cliente tipado compila contra él. |
| CA-04 | Login con `username` + contraseña válidos guarda la sesión, consulta `/auth/me` y redirige al home del rol (`operador → /operador`, `repartidor → /repartidor`, `admin → /admin`). |
| CA-05 | Login con correo (texto con `@`) envía `email`, no `username`, y lleva a `/cliente`. |
| CA-06 | Login con 400 (arreglo de mensajes), 401, 429 y fallo de red muestra el mensaje correspondiente sin perder lo escrito en el campo usuario. |
| CA-07 | Registro válido: `POST /customers` → login automático → `/cliente`. Si el login automático falla, va a `/login` con aviso de cuenta creada. |
| CA-08 | Registro con correo repetido (409), 400 y 429 muestra el mensaje del servidor donde corresponde y conserva los datos del formulario (no la contraseña). |
| CA-09 | Con datos inválidos (correo mal formado, contraseña <12 o >128, nombre <2 o >100, teléfono vacío) no se envía ninguna petición y se muestran mensajes por campo. |
| CA-10 | Al recargar con sesión vigente se restaura la sesión vía `/auth/me` sin pasar por login; si `/auth/me` da 401, se limpia y se va a `/login`. |
| CA-11 | Al vencer `expiresAt` se cierra la sesión y se muestra `/login?expired=1` con el aviso; un token ya vencido al cargar se descarta sin llamar a la API. |
| CA-12 | Sin sesión, una ruta privada redirige a `/login?next=…`. Con sesión de otro rol redirige al home propio. Con sesión, `/login` y `/registro` redirigen al home. |
| CA-13 | `next` con valores externos o malformados (`https://…`, `//…`, `javascript:…`, ruta de otro rol) se ignora y se usa el home del rol. |
| CA-14 | Un 401 en cualquier petición privada limpia sesión y caché y redirige con el aviso de sesión vencida; un 401 de `/auth/login` **no** dispara ese flujo. |
| CA-15 | Logout llama a `POST /auth/logout`, borra token y caché y lleva a `/login`; si la llamada falla igual se cierra localmente. |
| CA-16 | El *shell* muestra marca, nombre/rol y botón «Salir»; la navegación lista solo secciones del rol; es usable desde 360 px (menú en panel lateral) hasta escritorio. |
| CA-17 | Accesibilidad básica: etiquetas asociadas, foco visible, errores anunciados (`aria-live`), formularios operables solo con teclado, contraste AA en tema por defecto. |
| CA-18 | El token no aparece en URLs, `console` ni mensajes de error, y no se envía a orígenes distintos de `NEXT_PUBLIC_API_URL`. |
| CA-19 | Pruebas: unitarias (almacén de sesión, matriz de roles, `next` seguro, mapeo de errores), de componente (login, registro, guardas) y E2E con Playwright contra la API simulada (login de cada rol, registro, rol equivocado, expiración). |

## 10. Verificación contra el back real

Con el back local (`npm run db:up`, `migration:run`, `seed`, `start:dev` en `:3000` y `CORS_ORIGINS` con `http://localhost:3001`):

1. Login como `admin`, `operador` y `repartidor` (contraseñas de `SEED_*` del `.env` del back) → cada uno aterriza en su panel.
2. Registrar un cliente (`300 765 4322`) → entra a `/cliente`.
3. Confirmar qué devuelve `/auth/me` como `username` para un cliente (decide cómo se muestra su nombre en el *shell*).
4. Cerrar sesión y comprobar que el mismo token devuelve 401 en el back.

La evidencia (comandos y salidas) va en `docs/commits/001.md`.

## 11. Estructura propuesta del repo

```
src/
  app/
    (public)/        # /, /login, /registro
    (private)/
      cliente/ operador/ repartidor/ admin/
  components/
    ui/              # shadcn
    layout/          # AppShell, nav por rol
  features/auth/     # formularios, hooks, guardas
  lib/
    api/             # cliente, schema.d.ts, ApiError
    auth/            # session, roles, safe-next
    env.ts
docs/                # openapi.json, decisions.md, commits/
specs/001-base-auth-roles/   # spec.md, plan.md, tasks.md
scripts/gen-api.mjs
```

## 12. Riesgos y pendientes

- **Sin refresh:** cada vencimiento obliga a iniciar sesión otra vez (15 min en pruebas). Se mitiga con el aviso claro y conservando `next`.
- **Guardas solo de cliente:** pueden verse un instante de *skeleton*; es UX, no seguridad.
- **CORS:** si el back no incluye `http://localhost:3001` en `CORS_ORIGINS`, el login falla en el navegador aunque funcione en Swagger. Es lo primero a revisar.
- **Identidad visual sin definir:** se usa tema neutro; cuando exista paleta/logo se cambian los tokens de Tailwind sin tocar componentes.
- **Datos pendientes del back** (ver §4, hallazgos 2, 5 y 6).

## 13. Siguiente paso

Si apruebas (o ajustas) las decisiones D-007 a D-013, redacto `plan.md` (versiones, dependencias, orden de implementación) y `tasks.md`. No escribo código hasta tu aprobación.
