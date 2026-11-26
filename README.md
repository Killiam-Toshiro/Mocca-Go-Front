# Mocca Go Front

Frontend (Next.js) de Mocca Go: domicilios de café y snacks dentro del campus de la Universidad Icesi.

## Cómo se trabaja
Spec-Driven Design: cada incremento pasa por `spec` → `plan` → `tasks` → código → pruebas → overview. Ver `specs/README.md`.

## Estructura
```
specs/            # specs, planes y tareas por incremento (+ _templates)
docs/
  frontend-handoff.md   # contexto del proyecto
  openapi.json          # contrato del back
  decisions.md          # registro de decisiones D-nnn
  commits/              # overview de cada incremento
CLAUDE.md         # guía de trabajo para Claude
```

## Cómo correrlo
Requiere Node 24. Copia `.env.example` a `.env.local` y ajusta `API_URL`.

Con el back real (`Mocca-Go`: `npm run db:up`, `migration:run`, `seed`, `start` en `:3000`):
```
API_URL=http://127.0.0.1:3000/api/v1
```
Sin el back, con la API simulada (usuarios y casos en la cabecera de `tests/mock-api/server.mts`):
```
node tests/mock-api/server.mts      # puerto 4010, en otra terminal
API_URL=http://127.0.0.1:4010/api/v1
```
Después `npm run dev` y abre `http://localhost:3001` (no uses la IP de red en desarrollo).

Calidad: `npm run lint`, `typecheck`, `format:check`, `test`, `api:check`, `build` + `check:bundle`, y `npm run e2e` (antes, `npx playwright install chromium`).

## Estado
Incremento 001 (base, login/registro y rutas por rol): implementado, **en revisión**. Pendiente la verificación contra el back real (T-24). Ver `docs/commits/001.md`.
