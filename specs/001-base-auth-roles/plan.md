# Plan 001 — Base, login/registro y rutas por rol

**Spec:** `specs/001-base-auth-roles/spec.md` (aprobada el 2026-11-09) · **Estado del plan:** aprobado el 2026-11-09

Vocabulario: **proxy de Next** = `src/proxy.ts` (antes `middleware.ts`; guardas y CSP). **Pasarela** = `/api/[...path]` (reenvía al back).

## 1. Enfoque técnico

| Bloque | Qué se construye | Archivos clave |
|---|---|---|
| A. Base | Proyecto Next 16 (App Router, Turbopack), TypeScript estricto, Tailwind 4, shadcn/ui, ESLint, Prettier, Vitest, Playwright. Se inicializa a mano (sin `create-next-app`) para fijar versiones exactas. | `package.json`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc.json`, `.nvmrc` (24), `.npmrc` (`save-exact=true`) |
| B. Configuración | `env.ts` valida con zod `API_URL`, `TRUST_PROXY_HOPS` (0–10, por defecto 0), `COOKIE_SECURE` (opcional) y `ALLOWED_ORIGINS` (opcional). Solo servidor (`server-only`). | `src/lib/server/env.ts`, `.env.example` |
| C. Contrato | `scripts/gen-api.mjs` lee `docs/openapi.json`, quita `/api/v1` de los paths, genera `schema.d.ts` con `openapi-typescript` y `routes.generated.ts` (método, patrón, pública o no, `own` para login/logout, `stream` para `text/event-stream`). Una operación es pública si no declara `security`. | `scripts/gen-api.mjs`, `src/lib/api/schema.d.ts`, `src/lib/api/routes.generated.ts` |
| D. Núcleo del servidor (funciones puras, sin Next) | `cookies` (nombre y atributos según `COOKIE_SECURE`), `origin` (CSRF), `client-ip` (D-023), `forward` (lógica de la pasarela con `fetch` inyectable), `safe-next`, `roles` (matriz rol → prefijos y home). | `src/lib/server/*.ts`, `src/lib/auth/*.ts` |
| E. Rutas de Next | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/session`, `GET /api/auth/expired`, `/api/[...path]` (pasarela). Errores propios en el formato `{statusCode, message, error}`. | `src/app/api/**/route.ts` |
| F. Proxy de Next | Si no hay cookie `session` en un prefijo privado → `/login?next=…`. Genera nonce y fija CSP y cabeceras de seguridad. | `src/proxy.ts` |
| G. Guardas de servidor | `getSession()` (con `cache` de React; llama a `/auth/me`) usada por el layout privado y los de cada rol (rol equivocado → home; 401 → `/api/auth/expired`) y por las páginas `/login` y `/registro` (con sesión → home). | `src/lib/server/session.ts`, `src/app/(private)/**/layout.tsx` |
| H. Cliente | `QueryProvider`, `SessionProvider` (recibe el usuario desde el servidor), cliente `openapi-fetch` con `baseUrl: "/api"`, `ApiError`, manejo global de 401, temporizador de vencimiento (lee `session_exp`), `useLogout`. | `src/features/auth/*`, `src/lib/api/client.ts` |
| I. UI | Componentes shadcn (button, input, label, form, card, alert, skeleton, sheet, dropdown-menu, sonner), `AppShell` con navegación por rol, formularios de login y registro, portada y paneles placeholder. | `src/components/**`, `src/app/(public)/**`, `src/app/(private)/**` |
| J. Pruebas | Unitarias y de integración con Vitest; servidor mock de la API para integración y E2E; Playwright. | `tests/mock-api/`, `e2e/`, `*.test.ts(x)` |
| K. Seguridad y CI | CSP con nonce, cabeceras, `check:bundle` (busca `API_URL` en lo servido al navegador), `npm audit`, Dependabot, workflow de CI. | `.github/workflows/ci.yml`, `.github/dependabot.yml`, `scripts/check-bundle.mjs` |

### Decisiones técnicas del plan

- **Cookies:** `session` o `__Host-session` según `COOKIE_SECURE` (D-024). `session_exp` nunca lleva prefijo. `Max-Age` sale de `expiresIn` de la respuesta del back. En Next 16, `cookies()` y `params` son asíncronos (`await`).
- **Pasarela:** reenvía con `fetch` de Node, devuelve `new Response(upstream.body, …)` (flujo) y envía cuerpos con `duplex: "half"`. Tiempo máximo de 10 s para rutas no `stream`; las `stream` no llevan tiempo máximo. Falla de conexión → 502, tiempo agotado → 504. Quita `set-cookie` y cabeceras *hop-by-hop* de la respuesta del back.
- **`getSession()`** devuelve `{ user, expiresAt }` o un motivo (`none` | `expired` | `error`); nunca lanza. Si el back no responde (red) se muestra una pantalla de error con «Reintentar», sin borrar la cookie.
- **CSP:** `style-src 'self' 'unsafe-inline'` (shadcn/Radix usan estilos en línea); los scripts van con nonce y `strict-dynamic`; en desarrollo se permite `'unsafe-eval'`. Con nonce las páginas son dinámicas (no se cachean), aceptable aquí.
- **E2E contra un build de producción** (`next build` + `next start`) con `COOKIE_SECURE=false`, y el mock en `127.0.0.1:4010`.
- **No se usa `next lint`** (retirado en Next 16): `eslint .` directo.

## 2. Dependencias y versiones

Verificadas con `npm view` el 2026-11-09 y fijadas **exactas** (sin `^`). Si `npm install` detecta conflictos de dependencias entre pares, se ajusta y se anota en `docs/commits/001.md`.

| Paquete | Versión | Motivo |
|---|---|---|
| `next` | 16.4.6 | App Router, `proxy.ts`, Turbopack |
| `react`, `react-dom` | 19.3.1 | Requerido por Next 16 |
| `typescript` | **5.9.3** | `typescript-eslint` 8.72 solo admite `<6.1` y `openapi-typescript` 7.13 declara `typescript@^5.x`; ni 6.x ni 7.x (D-025, ajustado al instalar) |
| `tailwindcss`, `@tailwindcss/postcss` | 4.3.5 | Estilos |
| `@tanstack/react-query` | 5.107.1 | Consultas y mutaciones |
| `openapi-fetch` | 0.17.0 | Cliente tipado |
| `openapi-typescript` (dev) | 7.13.0 | Tipos desde el OpenAPI |
| `react-hook-form` | 7.91.0 | Formularios |
| `zod` | 4.6.7 | Validación |
| `@hookform/resolvers` | 7.0.5 | Enlace RHF ↔ zod (comprobar compatibilidad con zod 4 al instalar) |
| `lucide-react`, `sonner`, `class-variance-authority`, `clsx`, `tailwind-merge`, `tw-animate-css` | 1.70.0, 2.0.8, 0.7.1, 2.1.1, 3.7.0, 1.4.0 | Base de shadcn |
| `server-only` | 0.0.1 | Impide importar código de servidor en el cliente |
| `vitest`, `@vitejs/plugin-react`, `jsdom` (dev) | 5.1.0, 6.3.0, 31.0.0 | Pruebas |
| `@testing-library/react`, `user-event`, `jest-dom` (dev) | 16.3.3, 14.6.8, 7.0.1 | Pruebas de componentes |
| `@playwright/test` (dev) | 1.65.0 | E2E |
| `eslint`, `eslint-config-next` (dev) | 10.14.0, 16.4.6 | Lint |
| `prettier`, `prettier-plugin-tailwindcss` (dev) | 3.9.10, 0.8.1 | Formato |
| `@types/node` (dev) | 24.x | Node 24 es el objetivo (no 26) |
| `@types/react`, `@types/react-dom` (dev) | 19.3.x | Tipos |
| `shadcn` | 4.23.0 | CLI, se ejecuta con `npx` (no se instala) |

Entorno: Node 24 (`.nvmrc`, igual que el back) y npm. `engines` en `package.json`.

## 3. Estructura de archivos

```
.github/{workflows/ci.yml, dependabot.yml}
.nvmrc  .npmrc  .env.example  .prettierrc.json  eslint.config.mjs  next.config.ts
tsconfig.json  vitest.config.mts  playwright.config.ts  postcss.config.mjs  components.json
scripts/{gen-api.mjs, check-bundle.mjs}
tests/mock-api/{server.mjs, scenarios.mjs}
e2e/{login.spec.ts, register.spec.ts, guards.spec.ts, session-expiry.spec.ts, security.spec.ts}
src/
  proxy.ts
  app/
    layout.tsx  globals.css
    (public)/{page.tsx, login/page.tsx, registro/page.tsx}
    (private)/{layout.tsx, cliente/, operador/, repartidor/, admin/}   # cada uno: layout.tsx + page.tsx
    api/{auth/{login,logout,session,expired}/route.ts, [...path]/route.ts}
  components/{ui/, layout/{app-shell.tsx, role-nav.tsx}}
  features/auth/{session-provider.tsx, login-form.tsx, register-form.tsx, use-logout.ts, expiry-timer.tsx, schemas.ts}
  lib/
    api/{client.ts, api-error.ts, schema.d.ts, routes.generated.ts}
    auth/{roles.ts, safe-next.ts}
    server/{env.ts, cookies.ts, origin.ts, client-ip.ts, forward.ts, session.ts, errors.ts}
    query-client.ts
docs/  specs/
```

## 4. Mapa CA → pruebas

| CA | Tipo | Archivo(s) |
|---|---|---|
| CA-01 | CI + manual | `ci.yml`; `npm run dev` en `:3001` |
| CA-02 | Unidad + script | `env.test.ts`; `scripts/check-bundle.mjs` (CI tras `build`) |
| CA-03 | Unidad | `scripts/gen-api.test.ts` (paths sin prefijo, `public`, `own`, `stream`); `npm run api:check` |
| CA-04 | Integración + E2E | `auth/login/route.test.ts`; `e2e/login.spec.ts` (3 roles de personal) |
| CA-05 | Unidad + E2E | `cookies.test.ts`; `e2e/security.spec.ts` (`document.cookie`, atributos) |
| CA-06 | Integración + E2E | `login/route.test.ts` (campo `email` vs `username`); `e2e/login.spec.ts` |
| CA-07 | Componente + integración | `login-form.test.tsx`, `login/route.test.ts` (400/401/429/502/504) |
| CA-08, CA-09 | Componente + E2E | `register-form.test.tsx`; `e2e/register.spec.ts` |
| CA-10 | Componente | `schemas.test.ts`, `register-form.test.tsx` |
| CA-11 | Integración + E2E | `session.test.ts`; `e2e/guards.spec.ts` (recarga sin destello) |
| CA-12 | Componente + E2E | `expiry-timer.test.tsx`; `e2e/session-expiry.spec.ts` |
| CA-13 | Unidad + E2E | `proxy.test.ts`, `roles.test.ts`; `e2e/guards.spec.ts` (sin bucle con sesión muerta) |
| CA-14 | Unidad | `safe-next.test.ts` |
| CA-15 | Unidad + integración | `forward.test.ts`; `[...path]/route.test.ts` |
| CA-16 | Unidad + E2E | `origin.test.ts`; `e2e/security.spec.ts` (403 y 415) |
| CA-17 | Integración + E2E | `logout/route.test.ts`; `e2e/login.spec.ts` |
| CA-18 | Integración | `forward.test.ts` con mock que emite fragmentos con retraso |
| CA-19 | E2E | `e2e/guards.spec.ts` en 360 px y escritorio |
| CA-20 | Componente | `login-form.test.tsx`, `register-form.test.tsx` (etiquetas, `autocomplete`, `aria-live`); revisión manual de contraste |
| CA-21 | Unidad + E2E | `proxy.test.ts` (`buildCsp`, nonce distinto); `e2e/security.spec.ts` (cabeceras, sin violaciones en consola) |
| CA-22 | CI + prueba | `ci.yml` (`npm audit --audit-level=high`), `dependabot.yml`; prueba que espía `console` durante login |
| CA-23 | — | Este mismo conjunto |
| CA-24 | Unidad + integración | `client-ip.test.ts`; `[...path]/route.test.ts` contra el mock |

## 5. Orden de implementación

1. **Base** (T-01 a T-04): proyecto, herramientas, Tailwind/shadcn, Vitest y Playwright; `lint`, `typecheck`, `test` y `build` en verde con una página vacía.
2. **Configuración y contrato** (T-05, T-06).
3. **Núcleo del servidor con pruebas primero** (T-07 a T-11): cookies, origen, IP real, `next` seguro, roles, errores.
4. **Mock de la API** (T-12) y **pasarela** (T-13, T-14).
5. **Rutas de autenticación** (T-15) y **guardas** (T-16, T-17).
6. **Cliente y UI** (T-18 a T-21).
7. **E2E, seguridad y CI** (T-22, T-23).
8. **Verificación contra el back real y cierre** (T-24 a T-26).

Cada paso termina con `lint`, `typecheck` y `test` en verde antes de pasar al siguiente.

## 6. Riesgos técnicos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Incompatibilidades entre versiones (TypeScript 7, `@hookform/resolvers` 7 con zod 4, ESLint 10) | Versiones fijas y probadas en T-01/T-02; si algo falla se retrocede a la última compatible y se registra. |
| La pasarela se convierte en proxy abierto | Tabla generada, normalización de ruta y pruebas dedicadas (CA-15); host fijo. |
| Bucle de redirección con sesión muerta | `/api/auth/expired` borra las cookies antes de redirigir; prueba E2E específica (CA-13). |
| CSP rompe estilos o hidratación | Probar en `next start`, no solo en `dev`; E2E falla si hay violaciones en consola. |
| El CORS del back no admite `Idempotency-Key` | No aplica al BFF (servidor a servidor); queda registrado como hallazgo 8. |
| IP real mal calculada | Función pura con casos (cabecera ausente, inválida, falsificada) y prueba contra el mock (CA-24). |
| Fuga del token a logs o respuestas | Prueba que espía `console` y comprueba que el cuerpo de las respuestas al navegador no contiene el token (CA-22, CA-05). |

## 7. Fuera de plan

- `Dockerfile`, `output: "standalone"` y configuración de Railway (incremento 9).
- SSE (incremento 3; solo se comprueba que la pasarela pasa flujos).
- Perfil y cambio de contraseña (incremento 6).
- Identidad visual definitiva.
