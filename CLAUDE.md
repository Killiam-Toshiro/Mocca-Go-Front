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

## Stack (D-001 a D-006)
Next.js App Router · TypeScript estricto · Tailwind + shadcn/ui · TanStack Query · `openapi-typescript` + `openapi-fetch` · react-hook-form + zod · Vitest + Testing Library · Playwright · ESLint + Prettier · npm · Node 24.

## Reglas de arquitectura
- Token en `sessionStorage` (D-004): los guardas son del lado del cliente y solo mejoran la UX; el back impone los permisos. Páginas privadas = client components.
- Los tipos de la API se generan desde `docs/openapi.json`; no se escriben a mano.
- Se usa `expiresIn` de la respuesta de login; no hay refresh: un 401 en una ruta privada lleva a `/login`.
- Errores del back: `{ statusCode, message: string | string[], error? }`, en español y mostrables.
- Tiempo real por SSE con `fetch` (no `EventSource`, porque necesita `Authorization`): al recibir `ready` se vuelve a consultar la lista y luego se aplican los eventos `order`; reconexión con espera creciente.
- Interfaz en `es-CO`; precios en COP sin decimales.

## Comandos
Se completan en el incremento 1 (`dev` en `:3001`, `lint`, `typecheck`, `test`, `build`, `api:types`).

## Back local
Node 24 y PostgreSQL 16: `npm run db:up`, `migration:run`, `seed`, `start:dev` (`:3000`). `CORS_ORIGINS` del back debe incluir `http://localhost:3001`.
