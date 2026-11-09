# Registro de decisiones

Formato: `D-nnn` · estado (`aceptada` | `propuesta` | `reemplazada por D-nnn`) · origen. Los criterios de aceptación viven en cada spec (`CA-nn`).

## Aceptadas

| ID | Decisión | Origen |
|---|---|---|
| D-001 | Solo web responsive (sin panel de escritorio aparte). | Usuario, 2026-11-09 |
| D-002 | Tailwind + shadcn/ui. | Usuario, 2026-11-09 |
| D-003 | Despliegue en Vercel (incremento 9); el dominio se añade a `CORS_ORIGINS` del back. | Usuario, 2026-11-09 |
| D-004 | El token de sesión se guarda en `sessionStorage`. Consecuencias: guardas del lado del cliente, páginas privadas como client components, sin sesión compartida entre pestañas. | Usuario, 2026-11-09 |
| D-005 | Next.js App Router, TypeScript estricto, npm (igual que el back), Node 24. | Handoff §10 |
| D-006 | Cliente tipado con `openapi-typescript` + `openapi-fetch`; consultas con TanStack Query. | Handoff §4 y §10 |

## Propuestas (pendientes de aprobación — spec 001)

| ID | Propuesta | Alternativa |
|---|---|---|
| D-007 | `npm run api:types` quita `/api/v1` de los paths de `docs/openapi.json` y genera `src/lib/api/schema.d.ts` (versionado). | Dejar los paths completos y que `NEXT_PUBLIC_API_URL` sea solo el origen. |
| D-008 | Un único campo «Usuario o correo»: con `@` se envía `email`, si no `username`. | Dos pestañas cliente / personal. |
| D-009 | Tras registrarse se inicia sesión automáticamente. | Redirigir siempre a `/login`. |
| D-010 | El rol se obtiene con `GET /auth/me`, no del JWT. | Leer el rol del JWT. |
| D-011 | Rutas por prefijo de rol; el rol equivocado se redirige a su home. | Pantalla «Sin acceso». |
| D-012 | `admin` solo accede a `/admin` en el incremento 1; cocina/despacho de consulta se deciden en los incrementos 4 y 5. | Acceso a todos los prefijos. |
| D-013 | Puerto de desarrollo `3001`. | — |
