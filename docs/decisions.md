# Registro de decisiones

Formato: `D-nnn` · estado (`aceptada` | `propuesta` | `reemplazada por D-nnn`) · origen. Los criterios de aceptación viven en cada spec (`CA-nn`).

## Aceptadas

| ID | Decisión | Origen |
|---|---|---|
| D-001 | Solo web responsive (sin panel de escritorio aparte). | Usuario, 2026-11-09 |
| D-002 | Tailwind + shadcn/ui. | Usuario, 2026-11-09 |
| D-005 | Next.js App Router, TypeScript estricto, npm (igual que el back), Node 24. | Handoff §10 |
| D-006 | Cliente tipado con `openapi-typescript` + `openapi-fetch`; consultas con TanStack Query. | Handoff §4 y §10 |
| D-007 | `npm run api:types` quita `/api/v1` de los paths de `docs/openapi.json` y genera `schema.d.ts` y `routes.generated.ts` (tabla de rutas del proxy de API). El cliente usa `baseUrl: "/api"`. | Usuario, 2026-11-09 |
| D-008 | Un único campo «Usuario o correo»: con `@` se envía `email`, si no `username`. | Usuario, 2026-11-09 |
| D-009 | Tras registrarse se inicia sesión automáticamente; si falla, `/login` con aviso. | Usuario, 2026-11-09 |
| D-010 | El rol se obtiene de `GET /auth/me` (lo hace el BFF), no del JWT. | Usuario, 2026-11-09 |
| D-011 | Rutas por prefijo de rol; el rol equivocado se redirige a su home. | Usuario, 2026-11-09 |
| D-012 | `admin` solo accede a `/admin` en el incremento 1; cocina/despacho de consulta se deciden en los incrementos 4 y 5. | Usuario, 2026-11-09 |
| D-013 | Puerto de desarrollo `3001`. | Usuario, 2026-11-09 |
| D-014 | Sesión en cookie `httpOnly` emitida por Next (BFF). El navegador solo habla con `/api/...` del mismo origen; Next añade el `Bearer` hacia el back. El back no cambia y el front no necesita CORS. | Usuario, 2026-11-09 |
| D-015 | Cookies `session` (`HttpOnly`, `SameSite=Lax`, `Secure` y prefijo `__Host-` en producción) y `session_exp` (legible, solo la hora de vencimiento). | Usuario, 2026-11-09 |
| D-016 | El proxy de API solo reenvía `método + ruta` de la tabla generada del OpenAPI; normaliza la ruta; host fijo; cabeceras permitidas; no reenvía la cookie; cuerpo en flujo. | Usuario, 2026-11-09 |
| D-017 | CSRF: `SameSite=Lax` + `Origin` obligatorio y coincidente en métodos no seguros + `Content-Type: application/json`. | Usuario, 2026-11-09 |
| D-018 | Guardas en dos capas: `proxy.ts` de Next (cookie presente) + layouts de servidor (`/auth/me` y rol). | Usuario, 2026-11-09 |
| D-019 | `API_URL` (solo servidor) reemplaza a `NEXT_PUBLIC_API_URL`; en Railway apunta a la red privada del servicio `api`. | Usuario, 2026-11-09 |
| D-020 | Servidor mock de la API en Node (`tests/mock-api`) para integración y E2E. | Usuario, 2026-11-09 |
| D-022 | Despliegue del front en Railway como contenedor Node persistente (`next build` + `next start`), junto al back y con `API_URL` por la red privada. Motivo: los canales SSE atraviesan el proxy y necesitan conexiones largas sin cortes por duración de función. | Usuario, 2026-11-09 |
| D-023 | **IP real hacia el back sin cambiar el back.** El front tiene su propia variable `TRUST_PROXY_HOPS` (0 en local, 1 en Railway; mismo criterio que D-56 del back). Con n > 0, el proxy de API toma la IP del cliente de `X-Forwarded-For` contando n entradas desde la derecha, la valida como IP y la envía al back **sustituyendo** cualquier `X-Forwarded-For` entrante; con 0 no envía la cabecera. | Usuario, 2026-11-09 |
| D-024 | `COOKIE_SECURE` (opcional) fuerza `Secure` y el prefijo `__Host-`; por defecto `true` si `NODE_ENV=production`. Permite correr un build de producción en `http://localhost` para las pruebas E2E. | Usuario, 2026-11-09 |
| D-025 | TypeScript fijado en **5.9.3** (no 6.x ni 7.x): `typescript-eslint` 8.72 solo admite `<6.1` y `openapi-typescript` 7.13 declara `typescript@^5.x`. Corregida el 2026-11-09 al instalar (la propuesta inicial decía 6.0.x). Se revisa al actualizar esas herramientas. | Usuario, 2026-11-09 (ajuste técnico en T-01) |
| D-026 | **Nombre visible del cliente.** `/auth/me` devuelve para un cliente su `username` interno (identificador de 17 caracteres hexadecimales generado por el back), que no debe mostrarse. El saludo y el encabezado usan `fullName` de `GET /customers/me` (consulta en el navegador con caché de 5 min, hook `useDisplayName`); mientras llega o si falla se muestra «Hola» / «Mi cuenta», nunca el identificador. El personal sigue usando su `username`. | Usuario, 2026-11-10 (hallazgo P-03) |
| D-027 | **Paleta y logo de Mocca Go.** Naranja ámbar `#fd8000` como color de marca y marrones claros (crema, café con leche, espresso, tostado) para el resto. Todo se define como tokens en `src/app/globals.css`; el texto sobre el ámbar va en espresso (blanco sobre ámbar da 2.5:1) y los enlaces usan el naranja tostado `#a94400`. Logo: taza de café dentro de un círculo naranja con «Mocca Go» al lado. Detalle, contrastes y cómo cambiarlo: `docs/design-tokens.md`. Reemplaza el tema neutro provisional. | Usuario, 2026-11-10 |

## Reemplazadas

| ID | Decisión original | Reemplazada por |
|---|---|---|
| D-003 | Despliegue en Vercel (incremento 9); el dominio se añade a `CORS_ORIGINS` del back. | D-022 (2026-11-09: con BFF no hace falta CORS y el SSE por el proxy encaja mejor en un contenedor persistente) |
| D-004 | Token de sesión en `sessionStorage`. | D-014 (2026-11-09, tras evaluar riesgos de XSS) |

## Pendientes abiertos

| ID | Pendiente | Cuándo |
|---|---|---|
| P-01 | ~~Cambio en el back para la IP real~~ **Resuelto sin cambios en el back** (ver D-023): el back ya soporta `TRUST_PROXY_HOPS` (D-56 del back) y vale `1` en Railway. Verificar en el despliegue que la IP que ve el back es la del cliente. | Incremento 9 |
| P-02 | ~~Hosting~~ **Resuelto por D-022 (Railway).** Verificar en el incremento 3 el límite de duración de petición del proxy de Railway. | Incremento 3 |
| P-03 | ~~Verificar qué devuelve `/auth/me` como `username` de un cliente~~ **Resuelto (D-026):** devuelve un identificador interno; se muestra `fullName` de `GET /customers/me`. | Incremento 1 |
| P-04 | Verificar en Railway que `request.nextUrl` (redirecciones de `proxy.ts`) use el host público y no el interno; si no, construir el origen desde `X-Forwarded-Host`/`X-Forwarded-Proto`. | Despliegue (incremento 9) |
