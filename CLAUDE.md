# Mocca Go Front — guía para Claude

## Contexto
Frontend de Mocca Go (domicilios de café y snacks en el campus de la Universidad Icesi, Cali). El back vive en otro repo (`Mocca-Go`, NestJS). Contexto completo en `docs/frontend-handoff.md`; contrato en `docs/openapi.json`. Moneda: pesos COP enteros. Zona horaria: America/Bogota (UTC−5).

## Cómo trabajar con Sebastián
- **Siempre responde en español.**
- Metodología **Spec-Driven Design**: spec → aprobación → `plan.md` → aprobación → `tasks.md` → código → pruebas → `docs/commits/NNN.md`. Tras cada incremento, **detente para su revisión**.
- **No hagas commit ni push** salvo que lo pida.
- Decisiones en `docs/decisions.md` (D-nnn); criterios de aceptación en la spec (CA-nn).
- Verifica con evidencia real (comandos y números), no con afirmaciones.
- No escribas código de un incremento cuya spec no esté aprobada.

## Stack (D-001 a D-006, D-014)
Next.js App Router · TypeScript estricto · Tailwind + shadcn/ui · TanStack Query · `openapi-typescript` + `openapi-fetch` · react-hook-form + zod · Vitest + Testing Library · Playwright (con servidor mock de la API) · ESLint + Prettier · npm · Node 24 · despliegue en Railway (D-022).

## Reglas de arquitectura
- **Sesión con BFF (D-014):** el token vive en una cookie `httpOnly` que solo Next lee; el navegador habla únicamente con `/api/...` del mismo origen y Next añade el `Bearer` hacia el back. **Nunca** exponer el token al JS del navegador ni guardarlo en `localStorage`/`sessionStorage`.
- El proxy `/api/[...path]` solo reenvía rutas de la tabla generada del OpenAPI (no es un proxy abierto), no reenvía la cookie al back y devuelve el cuerpo como flujo.
- Métodos no seguros exigen `Origin` coincidente y `Content-Type: application/json` (CSRF). Ningún GET modifica datos.
- Guardas en el servidor (middleware + layouts); el back sigue imponiendo los permisos.
- Cabeceras de seguridad y CSP con nonce en todas las páginas. Sin `dangerouslySetInnerHTML` ni scripts de terceros. Nada secreto en `NEXT_PUBLIC_*`; no registrar tokens ni cuerpos de login/registro.
- Los tipos de la API se generan desde `docs/openapi.json`; no se escriben a mano.
- Se usa `expiresIn` de la respuesta de login como `Max-Age` de la cookie; no hay refresh: un 401 en una ruta privada lleva a `/login`.
- Un 403 en `PATCH /auth/password` significa «contraseña actual incorrecta», no falta de permiso.
- Errores del back: `{ statusCode, message: string | string[], error? }`, en español y mostrables.
- Tiempo real por SSE con `fetch` (no `EventSource`, porque necesita `Authorization`): al recibir `ready` se vuelve a consultar la lista y luego se aplican los eventos `order`; reconexión con espera creciente.
- Interfaz en `es-CO`; precios en COP sin decimales.

## Comandos
`npm run dev` (`:3001`) · `build` · `start` (usa `PORT`; local: `npm run start -- -p 3001`) · `lint` · `typecheck` · `format` / `format:check` · `test` · `e2e` (requiere `npx playwright install chromium`). `api:types` (regenera el contrato desde `docs/openapi.json`) y `api:check` (falla si está desactualizado); `check:bundle` (tras `build`: falla si `.next/static` contiene configuración del servidor). Para `npm run dev`, copia antes `.env.example` a `.env.local` y ábrelo por `http://localhost:3001` (por la IP de red, Next bloquea recursos en desarrollo). Usa `127.0.0.1` y no `localhost` en `API_URL` (el mock escucha solo en IPv4). API simulada: `node tests/mock-api/server.mts` (puerto 4010; usuarios y casos en la cabecera del archivo).

## Back local
Node 24 y PostgreSQL 16: `npm run db:up`, `migration:run`, `seed`, `start:dev` (`:3000`). El front lo consume con `API_URL=http://127.0.0.1:3000/api/v1` (variable de servidor); con BFF no requiere CORS.
