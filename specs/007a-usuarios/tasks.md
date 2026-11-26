# Tareas 007a — Admin: usuarios

**Spec:** `spec.md` v3 · **Plan:** `plan.md` (aprobado el 2026-11-11). Una tarea se marca `[x]` solo con evidencia real (prueba o comando ejecutado).

## Fase 1 — Mock
- [x] T-01 `tests/mock-api/users.ts`: almacén (personal con contraseña, clientes del almacén de clientes), `list` (search/role/orden/paginación), `create`, `update`, `changeRole`, `remove`, `setContact`/`restoreContact`, revocación de sesiones.
- [x] T-02 `server.mts`: rutas `/users*`, login del personal desde el almacén, `PATCH /auth/password` también para el personal, contacto de repartidores compartido con el despacho, reinicio.
- [x] T-03 `users.test.ts` y el resto de pruebas del mock en verde.

## Fase 2 — Lógica
- [x] T-04 `src/lib/users/`: tipos, roles y filtros, clave genérica, esquemas, errores.
- [x] T-05 `use-debounced-value`, `use-users` y hooks de acciones (crear, editar, rol, eliminar) + pruebas.

## Fase 3 — Pantalla de usuarios
- [x] T-06 `UsersView`, filtros, lista (tabla/tarjetas), paginación.
- [x] T-07 Panel: crear, editar, restablecer contraseña, cambiar rol, eliminar.
- [x] T-08 Ruta `/admin/usuarios`, navegación y pruebas de componente.

## Fase 4 — Mi cuenta
- [x] T-09 `AccountView`, rutas `/{admin,operador,repartidor}/cuenta`, navegación, pruebas.

## Fase 5 — Pasarela y E2E
- [x] T-10 `route.test.ts` (pasarela) y E2E `users.spec.ts` y `account.spec.ts` (escritorio y 360 px).

## Fase 6 — Cierre
- [x] T-11 `format:check`, `lint`, `typecheck`, `api:check`, `test`, `build`, `check:bundle`, `audit`, E2E completo.
- [x] T-12 `docs/decisions.md` (D-105…), `docs/commits/007a.md`, `specs/README.md`.

## Verificación manual (tuya, contra el back real) — ver spec §9
- [ ] P-09 Back: borrar usuario con historial → 409 «historial asociado».
- [ ] M-01…M-06 Pasos de la §9 del spec.
